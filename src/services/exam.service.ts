import { apiService } from './api';
import { serviceRegistry } from './config';
import { normalizePaginatedResponse } from '@/utils/api-utils';
import { courseService, type Course } from './course.service';
import { proctorService, type ExamProctor } from './proctor.service';

export interface Exam {
    external_id: string;
    title: string;
    course_id: string;
    course_name?: string;
    exam_duration: number;
    exam_instructions: string;
    video_instructions_url: string;
    date_added: string;
    questions?: ExamQuestion[];
}

export interface ExamQuestion {
    external_id: string;
    exam: string;
    text: string;
    score: number;
    answers?: ExamAnswer[];
}

export interface ExamAnswer {
    external_id: string;
    exam_question: string;
    text: string;
    is_correct: boolean;
}

export interface UserExamResult {
    external_id: string;
    user_id: string;
    username: string;
    exam: string;
    exam_title?: string;
    score: number;
    date_taken: string;
    result_message?: string;
    result_status: 'PASSED' | 'FAILED';
    user_answers?: UserExamAnswer[];
}

export interface UserExamAnswer {
    external_id: string;
    user_exam_result: string;
    exam_question: string;
    exam_answer?: string;
    flagged: boolean;
}

export interface ExamAppointment {
    external_id: string;
    user_id: string;
    username: string;
    exam: string;
    exam_title?: string;
    proctor_id?: string;
    proctor_name?: string;
    appointment_date: string;
    created_at: string;
    room_url_1?: string;
    room_url_2?: string;
    can_start: boolean;
    is_entered: boolean;
    entered_datetime?: string;
    exam_time?: number;
    appointment_status: string;
}

class ExamService {
    private readonly APP_ID = 20;

    async getExamReplicas(): Promise<string[]> {
        return serviceRegistry.getServiceReplicas(this.APP_ID, 'exam');
    }

    async getRandomExamReplica(): Promise<string | null> {
        const replicas = await this.getExamReplicas();
        return serviceRegistry.getRandomReplica(replicas);
    }

    private async enrichExamWithCourseName(exam: Exam): Promise<Exam> {
        try {
            const course = await courseService.getCourse(exam.course_id);
            return {
                ...exam,
                course_name: course.title || course.name || exam.course_id
            };
        } catch (error) {
            return {
                ...exam,
                course_name: exam.course_id
            };
        }
    }

    private async enrichAppointment(appointment: ExamAppointment): Promise<ExamAppointment> {
        const enrichedAppointment = { ...appointment };

        try {
            if (appointment.exam) {
                const exam = await this.getExam(appointment.exam);
                enrichedAppointment.exam_title = exam.title;
            }
        } catch (error) {
            enrichedAppointment.exam_title = appointment.exam;
        }

        try {
            if (appointment.proctor_id) {
                const proctor = await proctorService.getProctor(appointment.proctor_id);
                enrichedAppointment.proctor_name = proctor.username;
            }
        } catch (error) {
            enrichedAppointment.proctor_name = appointment.proctor_id;
        }

        return enrichedAppointment;
    }

    async getExam(examId: string): Promise<Exam> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const exam = await apiService.get<Exam>(baseUrl, `/exams/${examId}/`);
            return await this.enrichExamWithCourseName(exam);
        } catch (error: any) {
            // Try to sync the exam from another replica
            await this.syncExamToReplica(examId, baseUrl);

            // Try again
            const exam = await apiService.get<Exam>(baseUrl, `/exams/${examId}/`);
            return await this.enrichExamWithCourseName(exam);
        }
    }

    private async syncExamToReplica(examId: string, targetReplicaUrl: string): Promise<void> {
        try {
            // Get exam from another replica first
            const otherReplicas = await this.getExamReplicas();
            const otherReplica = otherReplicas.find(url => url !== targetReplicaUrl);

            if (!otherReplica) {
                throw new Error('No other replicas available for sync');
            }

            // Fetch exam from another replica
            const exam = await apiService.get<Exam>(otherReplica, `/exams/${examId}/`);

            // Prepare sync data
            const syncData = {
                external_id: exam.external_id,
                title: exam.title,
                course_id: exam.course_id,
                exam_duration: exam.exam_duration,
                exam_instructions: exam.exam_instructions,
                video_instructions_url: exam.video_instructions_url,
                date_added: exam.date_added
            };

            // Sync to target replica
            await apiService.post(targetReplicaUrl, `/sync/exams/`, syncData);
        } catch (error) {
            throw error;
        }
    }

    async getExams(filters?: {
        course_id?: string;
        page?: number;
        page_size?: number;
    }): Promise<Exam[]> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const params = new URLSearchParams();
            if (filters?.course_id) params.append('course_id', filters.course_id);
            if (filters?.page) params.append('page', filters.page.toString());
            if (filters?.page_size) params.append('page_size', filters.page_size.toString());

            const query = params.toString();
            const endpoint = query ? `/exams/?${query}` : '/exams/';

            const response = await apiService.get<any>(baseUrl, endpoint);
            const exams = normalizePaginatedResponse<Exam>(response).results;

            const enrichedExams = await Promise.all(
                exams.map(exam => this.enrichExamWithCourseName(exam))
            );

            return enrichedExams;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to fetch exams');
        }
    }

    async getExamQuestions(examId: string): Promise<ExamQuestion[]> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const endpoint = `/exam-questions/?exam=${examId}`;

            const response = await apiService.get<any>(baseUrl, endpoint);
            const questions = normalizePaginatedResponse<ExamQuestion>(response).results;

            if (questions.length === 0) {
                return [];
            }

            // Fetch answers for each question - they should be filtered by question
            const questionsWithAnswers = await Promise.all(
                questions.map(async (question) => {
                    try {
                        if (!question.external_id || question.external_id.trim() === '') {
                            return { ...question, answers: [] };
                        }

                        const answers = await this.getQuestionAnswers(question.external_id);

                        // Filter answers to ensure they belong to this question
                        const filteredAnswers = answers.filter(a =>
                        a.exam_question === question.external_id
                        );

                        return {
                            ...question,
                            answers: filteredAnswers
                        };
                    } catch (error) {
                        return {
                            ...question,
                            answers: []
                        };
                    }
                })
            );

            return questionsWithAnswers;
        } catch (error: any) {
            if (error.status === 404) {
                return [];
            }
            throw new Error(error.message || 'Failed to fetch exam questions');
        }
    }

    async getQuestionAnswers(questionId: string): Promise<ExamAnswer[]> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const endpoint = `/exam-answers/?exam_question=${questionId}`;

            const response = await apiService.get<any>(baseUrl, endpoint);
            const answers = normalizePaginatedResponse<ExamAnswer>(response).results;

            // Double-check that answers belong to this question
            return answers.filter(a => a.exam_question === questionId);
        } catch (error: any) {
            return [];
        }
    }

    async getUserExamResults(userId: string, examId?: string): Promise<UserExamResult[]> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const params = new URLSearchParams();
            params.append('user_id', userId);
            if (examId) params.append('exam_id', examId);

            const endpoint = `/user-exam-results/?${params.toString()}`;

            const response = await apiService.get<any>(baseUrl, endpoint);
            const results = normalizePaginatedResponse<UserExamResult>(response).results;

            const enrichedResults = await Promise.all(
                results.map(async (result) => {
                    try {
                        const exam = await this.getExam(result.exam);
                        return {
                            ...result,
                            exam_title: exam.title
                        };
                    } catch (error) {
                        return result;
                    }
                })
            );

            return enrichedResults;
        } catch (error: any) {
            if (error.status === 404) {
                return [];
            }
            throw new Error(error.message || 'Failed to fetch user exam results');
        }
    }

    async getUserExamResultsForExam(userId: string, examId: string): Promise<UserExamResult[]> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const params = new URLSearchParams();
            params.append('user_id', userId);
            params.append('exam_id', examId);

            const endpoint = `/user-exam-results/?${params.toString()}`;

            const response = await apiService.get<any>(baseUrl, endpoint);
            const results = normalizePaginatedResponse<UserExamResult>(response).results;

            // Sort by date taken (newest first)
            return results.sort((a, b) =>
            new Date(b.date_taken).getTime() - new Date(a.date_taken).getTime()
            );
        } catch (error: any) {
            return [];
        }
    }

    async submitExam(resultData: Partial<UserExamResult>): Promise<UserExamResult> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            // Make sure the data is properly formatted
            const formattedData = {
                ...resultData,
                // Ensure exam is a string (external_id)
                exam: resultData.exam,
            };

            const result = await apiService.post<UserExamResult>(baseUrl, '/submit-exam/', formattedData);

            if (result.exam) {
                try {
                    const exam = await this.getExam(result.exam);
                    result.exam_title = exam.title;
                } catch (error) {
                    // ignore
                }
            }

            return result;
        } catch (error: any) {
            // Try the sync endpoint as fallback
            try {
                const syncResult = await apiService.post<any>(
                    baseUrl,
                    `/sync/user-exam-results/`,
                    resultData
                );

                // We need to get the actual result data
                const results = await this.getUserExamResults(resultData.user_id!, resultData.exam!);
                if (results.length > 0) {
                    return results[0];
                }
                throw new Error('Failed to retrieve submitted exam result');
            } catch (syncError: any) {
                throw new Error(error.message || 'Failed to submit exam');
            }
        }
    }

    async getExamAppointments(userId?: string, examId?: string): Promise<ExamAppointment[]> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const params = new URLSearchParams();
            if (userId) params.append('user_id', userId);
            if (examId) params.append('exam_id', examId);

            const query = params.toString();
            const endpoint = query ? `/exam-appointments/?${query}` : '/exam-appointments/';

            const response = await apiService.get<any>(baseUrl, endpoint);
            const appointments = normalizePaginatedResponse<ExamAppointment>(response).results;

            const enrichedAppointments = await Promise.all(
                appointments.map(appointment => this.enrichAppointment(appointment))
            );

            // Sort by appointment date (newest first)
            return enrichedAppointments.sort((a, b) =>
            new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
            );
        } catch (error: any) {
            if (error.status === 404) {
                return [];
            }
            throw new Error(error.message || 'Failed to fetch exam appointments');
        }
    }

    async getAppointmentById(appointmentId: string): Promise<ExamAppointment> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const appointment = await apiService.get<ExamAppointment>(
                baseUrl,
                `/exam-appointments/${appointmentId}/`
            );
            return await this.enrichAppointment(appointment);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to fetch appointment');
        }
    }

    async createExamAppointment(appointmentData: Partial<ExamAppointment>): Promise<ExamAppointment> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            // Ensure exam field is properly formatted as external_id string
            const cleanData = { ...appointmentData };

            // Make sure we're using external_id for exam field, not numeric ID
            if (cleanData.exam && typeof cleanData.exam !== 'string') {
                cleanData.exam = cleanData.exam.toString();
            }

            const appointment = await apiService.post<ExamAppointment>(
                baseUrl,
                '/exam-appointments/',
                cleanData
            );

            return await this.enrichAppointment(appointment);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to create exam appointment');
        }
    }

    async updateExamAppointment(appointmentId: string, updateData: Partial<ExamAppointment>): Promise<ExamAppointment> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const appointment = await apiService.patch<ExamAppointment>(
                baseUrl,
                `/exam-appointments/${appointmentId}/`,
                updateData
            );

            return await this.enrichAppointment(appointment);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to update exam appointment');
        }
    }

    async updateAppointmentStatus(appointmentId: string, status: string, canStart: boolean = false): Promise<ExamAppointment> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const appointment = await apiService.patch<ExamAppointment>(
                baseUrl,
                `/exam-appointments/${appointmentId}/`,
                { appointment_status: status, can_start: canStart }
            );

            return await this.enrichAppointment(appointment);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to update appointment status');
        }
    }

    async cancelExamAppointment(appointmentId: string): Promise<ExamAppointment> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const appointment = await apiService.patch<ExamAppointment>(
                baseUrl,
                `/exam-appointments/${appointmentId}/`,
                { appointment_status: 'Cancelled', can_start: false }
            );

            return await this.enrichAppointment(appointment);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to cancel exam appointment');
        }
    }

    async submitExamAppointment(appointmentData: Partial<ExamAppointment>): Promise<ExamAppointment> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const appointment = await apiService.post<ExamAppointment>(
                baseUrl,
                '/exam-appointments/',
                appointmentData
            );

            return await this.enrichAppointment(appointment);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to submit exam appointment');
        }
    }

    // New method to handle reschedule by creating a new appointment
    async rescheduleExamAppointment(oldAppointmentId: string, newAppointmentData: Partial<ExamAppointment>): Promise<{
        oldAppointment: ExamAppointment;
        newAppointment: ExamAppointment;
    }> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            // First, cancel the old appointment
            const oldAppointment = await this.cancelExamAppointment(oldAppointmentId);

            // Then create a new appointment with the new data
            // Ensure we use a new external_id for the new appointment
            const newAppointment = await this.createExamAppointment({
                ...newAppointmentData,
                external_id: `exam_appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            });

            return {
                oldAppointment,
                newAppointment
            };
        } catch (error: any) {
            throw new Error(error.message || 'Failed to reschedule exam appointment');
        }
    }

    async getExamAppointmentsByProctor(proctorId: string): Promise<ExamAppointment[]> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            const params = new URLSearchParams();
            params.append('proctor_id', proctorId);

            const endpoint = `/exam-appointments/?${params.toString()}`;

            const response = await apiService.get<any>(baseUrl, endpoint);
            const appointments = normalizePaginatedResponse<ExamAppointment>(response).results;

            const enrichedAppointments = await Promise.all(
                appointments.map(appointment => this.enrichAppointment(appointment))
            );

            // Sort by appointment date (newest first)
            return enrichedAppointments.sort((a, b) =>
            new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
            );
        } catch (error: any) {
            if (error.status === 404) {
                return [];
            }
            throw new Error(error.message || 'Failed to fetch exam appointments by proctor');
        }
    }
}

export const examService = new ExamService();
