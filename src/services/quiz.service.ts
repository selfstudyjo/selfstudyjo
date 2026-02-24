import { apiService } from './api';
import { serviceRegistry } from './config';
import { normalizePaginatedResponse, type PaginatedResponse } from '@/utils/api-utils';

export interface Quiz {
    external_id: string;
    title: string;
    course_id: string;
    lesson_id: string;
    quiz_duration: number; // in minutes
    description: string;
    date_added?: string;
    questions?: QuizQuestion[];
}

export interface QuizQuestion {
    external_id: string;
    quiz: string; // quiz external_id
    text: string;
    score: number;
    answers?: QuizAnswer[];
}

export interface QuizAnswer {
    external_id: string;
    quiz_question: string; // question external_id
    text: string;
    is_correct: boolean;
}

export interface UserQuizResult {
    external_id: string;
    user_id: string;
    username: string;
    quiz: string; // quiz external_id
    quiz_title?: string;
    score: number;
    date_taken?: string;
    result_message?: string;
    result_status: 'PASSED' | 'FAILED';
    user_answers?: UserQuizAnswer[];
}

export interface UserQuizAnswer {
    external_id: string;
    user_quiz_result?: string; // result external_id
    quiz_question: string; // question external_id
    quiz_answer?: string; // answer external_id (can be null for unanswered)
    flagged: boolean;
}

export interface SubmitQuizRequest {
    external_id?: string;
    user_id: string;
    username: string;
    quiz: string; // quiz external_id
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
    private readonly APP_ID = 20; // Exam app ID

    async getQuizReplicas(): Promise<string[]> {
        return serviceRegistry.getServiceReplicas(this.APP_ID, 'exam');
    }

    async getRandomQuizReplica(): Promise<string | null> {
        const replicas = await this.getQuizReplicas();
        return serviceRegistry.getRandomReplica(replicas);
    }

    // Get quiz by lesson ID
    async getQuizByLessonId(lessonId: string): Promise<Quiz | null> {
        const baseUrl = await this.getRandomQuizReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const response = await apiService.get<any>(baseUrl, `/quizzes/?lesson_id=${lessonId}`);
            const quizzes = normalizePaginatedResponse<Quiz>(response).results;

            if (quizzes.length === 0) {
                return null;
            }

            // Get the first quiz for the lesson (assuming one quiz per lesson)
            const quiz = quizzes[0];

            // Fetch quiz questions
            try {
                const questionsResponse = await apiService.get<any>(
                    baseUrl,
                    `/quiz-questions/?quiz=${quiz.external_id}`
                );
                const questions = normalizePaginatedResponse<QuizQuestion>(questionsResponse).results;

                // IMPORTANT: Filter questions to ensure they belong to this quiz
                const filteredQuestions = questions.filter(q => q.quiz === quiz.external_id);

                // Fetch answers for each question
                for (const question of filteredQuestions) {
                    try {
                        const answersResponse = await apiService.get<any>(
                            baseUrl,
                            `/quiz-answers/?quiz_question=${question.external_id}`
                        );
                        const answers = normalizePaginatedResponse<QuizAnswer>(answersResponse).results;

                        // Filter answers to only include those for this specific question
                        question.answers = answers.filter(answer =>
                            answer.quiz_question === question.external_id
                        );
                    } catch (err) {
                        console.error(`Failed to fetch answers for question ${question.external_id}:`, err);
                        question.answers = [];
                    }
                }

                quiz.questions = filteredQuestions;
            } catch (err) {
                console.error('Failed to fetch quiz questions:', err);
                quiz.questions = [];
            }

            return quiz;
        } catch (error) {
            console.error('Failed to fetch quiz by lesson ID:', error);
            throw error;
        }
    }

    // Get quiz by external ID
    async getQuiz(quizId: string): Promise<Quiz> {
        const baseUrl = await this.getRandomQuizReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const quiz = await apiService.get<Quiz>(baseUrl, `/quizzes/${quizId}/`);

            // Fetch quiz questions
            try {
                const questionsResponse = await apiService.get<any>(
                    baseUrl,
                    `/quiz-questions/?quiz=${quiz.external_id}`
                );
                const questions = normalizePaginatedResponse<QuizQuestion>(questionsResponse).results;

                // IMPORTANT: Filter questions to ensure they belong to this quiz
                const filteredQuestions = questions.filter(q => q.quiz === quiz.external_id);

                // Fetch answers for each question
                for (const question of filteredQuestions) {
                    try {
                        const answersResponse = await apiService.get<any>(
                            baseUrl,
                            `/quiz-answers/?quiz_question=${question.external_id}`
                        );
                        const answers = normalizePaginatedResponse<QuizAnswer>(answersResponse).results;

                        // Filter answers to only include those for this specific question
                        question.answers = answers.filter(answer =>
                            answer.quiz_question === question.external_id
                        );
                    } catch (err) {
                        console.error(`Failed to fetch answers for question ${question.external_id}:`, err);
                        question.answers = [];
                    }
                }

                quiz.questions = filteredQuestions;
            } catch (err) {
                console.error('Failed to fetch quiz questions:', err);
                quiz.questions = [];
            }

            return quiz;
        } catch (error) {
            console.error('Failed to fetch quiz:', error);
            throw error;
        }
    }

    // Get all quizzes for a course
    async getQuizzesByCourseId(courseId: string): Promise<Quiz[]> {
        const baseUrl = await this.getRandomQuizReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const response = await apiService.get<any>(baseUrl, `/quizzes/?course_id=${courseId}`);
            const quizzes = normalizePaginatedResponse<Quiz>(response).results;

            // For each quiz, fetch its questions and answers
            for (const quiz of quizzes) {
                try {
                    const questionsResponse = await apiService.get<any>(
                        baseUrl,
                        `/quiz-questions/?quiz=${quiz.external_id}`
                    );
                    const questions = normalizePaginatedResponse<QuizQuestion>(questionsResponse).results;

                    // IMPORTANT: Filter questions to ensure they belong to this quiz
                    const filteredQuestions = questions.filter(q => q.quiz === quiz.external_id);

                    // Fetch answers for each question
                    for (const question of filteredQuestions) {
                        try {
                            const answersResponse = await apiService.get<any>(
                                baseUrl,
                                `/quiz-answers/?quiz_question=${question.external_id}`
                            );
                            const answers = normalizePaginatedResponse<QuizAnswer>(answersResponse).results;

                            // Filter answers to only include those for this specific question
                            question.answers = answers.filter(answer =>
                                answer.quiz_question === question.external_id
                            );
                        } catch (err) {
                            console.error(`Failed to fetch answers for question ${question.external_id}:`, err);
                            question.answers = [];
                        }
                    }

                    quiz.questions = filteredQuestions;
                } catch (err) {
                    console.error('Failed to fetch quiz questions:', err);
                    quiz.questions = [];
                }
            }

            return quizzes;
        } catch (error) {
            console.error('Failed to fetch quizzes by course ID:', error);
            throw error;
        }
    }

    // Submit quiz
    async submitQuiz(submission: SubmitQuizRequest): Promise<SubmitQuizResponse> {
        const baseUrl = await this.getRandomQuizReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            console.log('Submitting quiz:', submission);

            // Ensure all required fields are present
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

            const result = await apiService.post<SubmitQuizResponse>(
                baseUrl,
                '/submit-quiz/',
                completeSubmission
            );

            console.log('Quiz submission successful:', result);
            return result;
        } catch (error) {
            console.error('Failed to submit quiz:', error);
            throw error;
        }
    }

    // Get user's quiz results for a specific quiz
    async getUserQuizResult(userId: string, quizId: string): Promise<UserQuizResult | null> {
        const baseUrl = await this.getRandomQuizReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const response = await apiService.get<any>(
                baseUrl,
                `/user-quiz-results/?user_id=${userId}&quiz_id=${quizId}`
            );
            const results = normalizePaginatedResponse<UserQuizResult>(response).results;

            if (results.length === 0) {
                return null;
            }

            // Return the most recent result
            return results[0];
        } catch (error) {
            console.error('Failed to fetch user quiz result:', error);
            return null;
        }
    }

    // Get all user quiz results
    async getUserQuizResults(userId: string): Promise<UserQuizResult[]> {
        const baseUrl = await this.getRandomQuizReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const response = await apiService.get<any>(
                baseUrl,
                `/user-quiz-results/?user_id=${userId}`
            );
            const results = normalizePaginatedResponse<UserQuizResult>(response).results;

            // Enrich with quiz titles if available
            const enriched = await Promise.all(
                results.map(async (result) => {
                    try {
                        const quiz = await this.getQuiz(result.quiz);
                        return {
                            ...result,
                            quiz_title: quiz.title
                        };
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

    // Check if user has already taken a quiz
    async hasUserTakenQuiz(userId: string, quizId: string): Promise<boolean> {
        const result = await this.getUserQuizResult(userId, quizId);
        return result !== null;
    }

    // Calculate quiz result
    calculateQuizResult(
        quiz: Quiz,
        userAnswers: Map<string, string> // question_id -> answer_id
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
        const passed = percentage >= 70; // Assuming 70% is passing

        return { score, total: quiz.questions.length, percentage, passed, correctAnswers };
    }

    // Create a user quiz result object
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

        // Generate result message
        const resultMessage = `You answered ${scoreData.correctAnswers} out of ${scoreData.total} questions correctly. Score: ${scoreData.percentage.toFixed(2)}%.`;

        return {
            external_id: `quiz_result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user_id: userId,
            username: username,
            quiz: quizId,
            score: scoreData.percentage, // Using percentage as score
            result_status: scoreData.passed ? 'PASSED' : 'FAILED',
            result_message: resultMessage,
            user_answers: userAnswersArray
        };
    }

    // NEW: Get a single quiz result by external_id
    async getQuizResultById(resultId: string): Promise<UserQuizResult> {
        const baseUrl = await this.getRandomQuizReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            // Try direct fetch (if endpoint exists)
            return await apiService.get<UserQuizResult>(
                baseUrl,
                `/user-quiz-results/${resultId}/`
            );
        } catch (error: any) {
            // Fallback: search through user results
            if (error.status === 404) {
                throw new Error('Quiz result not found');
            }
            throw error;
        }
    }

    // Optionally, we might want to get quiz details along with questions/answers for review
    async getQuizWithDetails(quizId: string): Promise<Quiz> {
        const baseUrl = await this.getRandomQuizReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const quiz = await apiService.get<Quiz>(baseUrl, `/quizzes/${quizId}/`);
            // Fetch questions and answers as in getQuiz
            const questionsResponse = await apiService.get<any>(
                baseUrl,
                `/quiz-questions/?quiz=${quiz.external_id}`
            );
            const questions = normalizePaginatedResponse<QuizQuestion>(questionsResponse).results;
            for (const question of questions) {
                const answersResponse = await apiService.get<any>(
                    baseUrl,
                    `/quiz-answers/?quiz_question=${question.external_id}`
                );
                question.answers = normalizePaginatedResponse<QuizAnswer>(answersResponse).results;
            }
            quiz.questions = questions;
            return quiz;
        } catch (error) {
            throw error;
        }
    }
}

export const quizService = new QuizService();