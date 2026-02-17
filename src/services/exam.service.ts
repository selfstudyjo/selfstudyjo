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
            console.warn('⚠️ Could not fetch course name, using ID:', exam.course_id);
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
            console.warn('⚠️ Could not fetch exam title for appointment:', appointment.external_id);
            enrichedAppointment.exam_title = appointment.exam;
        }

        try {
            if (appointment.proctor_id) {
                const proctor = await proctorService.getProctor(appointment.proctor_id);
                enrichedAppointment.proctor_name = proctor.username;
            }
        } catch (error) {
            console.warn('⚠️ Could not fetch proctor name for appointment:', appointment.external_id);
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
            console.log('🔍 [ExamService] Fetching exam:', `${baseUrl}/exams/${examId}/`);
            const exam = await apiService.get<Exam>(baseUrl, `/exams/${examId}/`);
            return await this.enrichExamWithCourseName(exam);
        } catch (error: any) {
            console.error('❌ [ExamService] Failed to fetch exam:', error);

            // Try to sync the exam from another replica
            await this.syncExamToReplica(examId, baseUrl);

            // Try again
            const exam = await apiService.get<Exam>(baseUrl, `/exams/${examId}/`);
            return await this.enrichExamWithCourseName(exam);
        }
    }

    private async syncExamToReplica(examId: string, targetReplicaUrl: string): Promise<void> {
        try {
            console.log(`🔄 Syncing exam ${examId} to replica ${targetReplicaUrl}`);

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
            console.log(`✅ Exam ${examId} synced to ${targetReplicaUrl}`);
        } catch (error) {
            console.error(`❌ Failed to sync exam ${examId}:`, error);
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

            console.log('🔍 [ExamService] Fetching exams:', `${baseUrl}${endpoint}`);

            const response = await apiService.get<any>(baseUrl, endpoint);
            const exams = normalizePaginatedResponse<Exam>(response).results;

            const enrichedExams = await Promise.all(
                exams.map(exam => this.enrichExamWithCourseName(exam))
            );

            return enrichedExams;
        } catch (error: any) {
            console.error('❌ [ExamService] Failed to fetch exams:', error);
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
            console.log('🔍 [ExamService] Fetching exam questions:', `${baseUrl}${endpoint}`);

            const response = await apiService.get<any>(baseUrl, endpoint);
            const questions = normalizePaginatedResponse<ExamQuestion>(response).results;

            if (questions.length === 0) {
                console.warn('⚠️ No questions found for exam:', examId);
                return [];
            }

            // Fetch answers for each question - they should be filtered by question
            const questionsWithAnswers = await Promise.all(
                questions.map(async (question) => {
                    try {
                        if (!question.external_id || question.external_id.trim() === '') {
                            console.warn('⚠️ Question has invalid external_id:', question);
                            return { ...question, answers: [] };
                        }

                        const answers = await this.getQuestionAnswers(question.external_id);
                        console.log(`Fetched ${answers.length} answers for question ${question.external_id}`);

                        // Filter answers to ensure they belong to this question
                        const filteredAnswers = answers.filter(a =>
                        a.exam_question === question.external_id
                        );

                        return {
                            ...question,
                            answers: filteredAnswers
                        };
                    } catch (error) {
                        console.warn('⚠️ Could not fetch answers for question:', question.external_id, error);
                        return {
                            ...question,
                            answers: []
                        };
                    }
                })
            );

            return questionsWithAnswers;
        } catch (error: any) {
            console.error('❌ [ExamService] Failed to fetch exam questions:', error);
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
            console.log('🔍 [ExamService] Fetching answers for question:', `${baseUrl}${endpoint}`);

            const response = await apiService.get<any>(baseUrl, endpoint);
            const answers = normalizePaginatedResponse<ExamAnswer>(response).results;

            // Double-check that answers belong to this question
            return answers.filter(a => a.exam_question === questionId);
        } catch (error: any) {
            console.error('❌ [ExamService] Failed to fetch answers:', error);
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
            console.log('🔍 [ExamService] Fetching user exam results:', `${baseUrl}${endpoint}`);

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
                        console.warn('⚠️ Could not fetch exam title for result:', result.external_id);
                        return result;
                    }
                })
            );

            return enrichedResults;
        } catch (error: any) {
            console.error('❌ [ExamService] Failed to fetch user exam results:', error);
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
            console.log('🔍 [ExamService] Fetching user exam results for specific exam:', `${baseUrl}${endpoint}`);

            const response = await apiService.get<any>(baseUrl, endpoint);
            const results = normalizePaginatedResponse<UserExamResult>(response).results;

            // Sort by date taken (newest first)
            return results.sort((a, b) =>
            new Date(b.date_taken).getTime() - new Date(a.date_taken).getTime()
            );
        } catch (error: any) {
            console.error('❌ [ExamService] Failed to fetch user exam results for exam:', error);
            return [];
        }
    }


    async submitExam(resultData: Partial<UserExamResult>): Promise<UserExamResult> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            console.log('🔍 [ExamService] Submitting exam:', resultData);

            // Make sure the data is properly formatted
            const formattedData = {
                ...resultData,
                // Ensure exam is a string (external_id)
                exam: resultData.exam,
            };

            console.log('📤 [ExamService] Formatted data for submission:', formattedData);

            const result = await apiService.post<UserExamResult>(baseUrl, '/submit-exam/', formattedData);

            if (result.exam) {
                try {
                    const exam = await this.getExam(result.exam);
                    result.exam_title = exam.title;
                } catch (error) {
                    console.warn('⚠️ Could not enrich exam result:', error);
                }
            }

            return result;
        } catch (error: any) {
            console.error('❌ [ExamService] Failed to submit exam:', error);

            // Try the sync endpoint as fallback
            console.log('🔄 Trying sync endpoint as fallback...');
            try {
                const syncResult = await apiService.post<any>(
                    baseUrl,
                    `/sync/user-exam-results/`,
                    resultData
                );
                console.log('✅ Exam submitted via sync endpoint');

                // We need to get the actual result data
                const results = await this.getUserExamResults(resultData.user_id!, resultData.exam!);
                if (results.length > 0) {
                    return results[0];
                }
                throw new Error('Failed to retrieve submitted exam result');
            } catch (syncError: any) {
                console.error('❌ Sync endpoint also failed:', syncError);
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

            console.log('🔍 [ExamService] Fetching exam appointments:', `${baseUrl}${endpoint}`);

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
            console.error('❌ [ExamService] Failed to fetch exam appointments:', error);
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
            console.log('🔍 [ExamService] Fetching appointment by ID:', `${baseUrl}/exam-appointments/${appointmentId}/`);
            const appointment = await apiService.get<ExamAppointment>(
                baseUrl,
                `/exam-appointments/${appointmentId}/`
            );
            return await this.enrichAppointment(appointment);
        } catch (error: any) {
            console.error('❌ [ExamService] Failed to fetch appointment:', error);
            throw new Error(error.message || 'Failed to fetch appointment');
        }
    }



    async createExamAppointment(appointmentData: Partial<ExamAppointment>): Promise<ExamAppointment> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            console.log('🔍 [ExamService] Creating exam appointment:', appointmentData);

            // Ensure exam field is properly formatted as external_id string
            const cleanData = { ...appointmentData };

            // Make sure we're using external_id for exam field, not numeric ID
            if (cleanData.exam && typeof cleanData.exam !== 'string') {
                console.warn('⚠️ Exam field is not a string, converting:', cleanData.exam);
                cleanData.exam = cleanData.exam.toString();
            }

            console.log('📤 Sending appointment data:', cleanData);

            const appointment = await apiService.post<ExamAppointment>(
                baseUrl,
                '/exam-appointments/',
                cleanData
            );

            return await this.enrichAppointment(appointment);
        } catch (error: any) {
            console.error('❌ [ExamService] Failed to create exam appointment:', error);

            // More detailed error logging
            if (error.data?.exam) {
                console.error('📝 Exam validation error:', error.data.exam);
            }

            throw new Error(error.message || 'Failed to create exam appointment');
        }
    }

    async updateExamAppointment(appointmentId: string, updateData: Partial<ExamAppointment>): Promise<ExamAppointment> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            console.log('🔍 [ExamService] Updating exam appointment:', { appointmentId, updateData });
            const appointment = await apiService.patch<ExamAppointment>(
                baseUrl,
                `/exam-appointments/${appointmentId}/`,
                updateData
            );

            return await this.enrichAppointment(appointment);
        } catch (error: any) {
            console.error('❌ [ExamService] Failed to update exam appointment:', error);
            throw new Error(error.message || 'Failed to update exam appointment');
        }
    }

    async updateAppointmentStatus(appointmentId: string, status: string, canStart: boolean = false): Promise<ExamAppointment> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            console.log('🔍 [ExamService] Updating appointment status:', { appointmentId, status, canStart });
            const appointment = await apiService.patch<ExamAppointment>(
                baseUrl,
                `/exam-appointments/${appointmentId}/`,
                { appointment_status: status, can_start: canStart }
            );

            return await this.enrichAppointment(appointment);
        } catch (error: any) {
            console.error('❌ [ExamService] Failed to update appointment status:', error);
            throw new Error(error.message || 'Failed to update appointment status');
        }
    }

    async cancelExamAppointment(appointmentId: string): Promise<ExamAppointment> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            console.log('🔍 [ExamService] Cancelling exam appointment:', appointmentId);
            const appointment = await apiService.patch<ExamAppointment>(
                baseUrl,
                `/exam-appointments/${appointmentId}/`,
                { appointment_status: 'Cancelled', can_start: false }
            );

            return await this.enrichAppointment(appointment);
        } catch (error: any) {
            console.error('❌ [ExamService] Failed to cancel exam appointment:', error);
            throw new Error(error.message || 'Failed to cancel exam appointment');
        }
    }

    async submitExamAppointment(appointmentData: Partial<ExamAppointment>): Promise<ExamAppointment> {
        const baseUrl = await this.getRandomExamReplica();
        if (!baseUrl) {
            throw new Error('No exam service replicas available');
        }

        try {
            console.log('🔍 [ExamService] Submitting exam appointment:', appointmentData);
            const appointment = await apiService.post<ExamAppointment>(
                baseUrl,
                '/exam-appointments/',
                appointmentData
            );

            return await this.enrichAppointment(appointment);
        } catch (error: any) {
            console.error('❌ [ExamService] Failed to submit exam appointment:', error);
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
            console.log('🔍 [ExamService] Rescheduling exam appointment:', { oldAppointmentId, newAppointmentData });

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
            console.error('❌ [ExamService] Failed to reschedule exam appointment:', error);
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
            console.log('🔍 [ExamService] Fetching exam appointments by proctor:', `${baseUrl}${endpoint}`);

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
            console.error('❌ [ExamService] Failed to fetch exam appointments by proctor:', error);
            if (error.status === 404) {
                return [];
            }
            throw new Error(error.message || 'Failed to fetch exam appointments by proctor');
        }
    }

}

export const examService = new ExamService();
