import { apiService } from './api';
import { serviceRegistry } from './config';
import { normalizePaginatedResponse, type PaginatedResponse } from '@/utils/api-utils';

export interface Course {
    id?: number;
    external_course_id: string;
    title: string;
    description: string;
    date_added?: string;
    image_url: string;
    lessons_count?: number;
    comments_count?: number;
}

export interface Lesson {
    id?: number;
    external_lesson_id: string;
    title: string;
    course?: string;
    course_external_id?: string;
    source_code_url?: string;
    reading_url?: string;
    date_added?: string;
    homeworks?: Homework[];
}

export interface Comment {
    id?: number;
    external_comment_id: string;
    content: string;
    date_added?: string;
    user_id: string;
    course?: string;
    course_external_id?: string;
}

export interface Homework {
    id?: number;
    external_homework_id: string;
    title: string;
    homework_url: string;
    course?: string;
    course_external_id?: string;
    lesson?: string;
    lesson_external_id?: string;
    description: string;
}

export interface SubmittedHomework {
    id?: number;
    external_submitted_homework_id: string;
    user_id: string;
    homework: string | number;
    homework_external_id?: string;
    submitted_homework_url: string;
    description?: string;
    date_submitted?: string;
}

export interface CourseRegistration {
    id?: number;
    external_id: string;
    user_id: string;
    course: string;
    course_external_id?: string;
    date_registered?: string;
}

export interface CourseFilters {
    search?: string;
    page?: number;
    page_size?: number;
    ordering?: string;
}

class CourseService {
    private readonly APP_ID = 19;

    async getCourseReplicas(): Promise<string[]> {
        return serviceRegistry.getServiceReplicas(this.APP_ID, 'course');
    }

    async getRandomCourseReplica(): Promise<string | null> {
        const replicas = await this.getCourseReplicas();
        return serviceRegistry.getRandomReplica(replicas);
    }

    // --- NEW: Batch fetch homeworks for a whole course ---
    async getHomeworksForCourse(courseId: string, baseUrl?: string): Promise<Homework[]> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            // Assuming the backend supports filtering by course_id
            const response = await apiService.get<any>(url, `/homeworks/?course_id=${courseId}`);
            return normalizePaginatedResponse<Homework>(response).results;
        } catch (error) {
            console.error('Failed to fetch homeworks for course:', error);
            return [];
        }
    }

    // --- All existing methods, now with optional baseUrl parameter for replica pinning ---
    async getCourses(filters?: CourseFilters, baseUrl?: string): Promise<PaginatedResponse<Course>> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            const params = new URLSearchParams();
            if (filters?.search) params.append('search', filters.search);
            if (filters?.page) params.append('page', filters.page.toString());
            if (filters?.page_size) params.append('page_size', filters.page_size.toString());
            if (filters?.ordering) params.append('ordering', filters.ordering);

            const query = params.toString();
            const endpoint = query ? `/courses/?${query}` : '/courses/';

            const response = await apiService.get<any>(url, endpoint);
            return normalizePaginatedResponse<Course>(response);
        } catch (error) {
            throw error;
        }
    }

    async getCourse(courseId: string, baseUrl?: string): Promise<Course> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            return await apiService.get<Course>(url, `/courses/${courseId}/`);
        } catch (error) {
            throw error;
        }
    }

    async getCourseById(courseId: number, baseUrl?: string): Promise<Course> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            const response = await apiService.get<any>(url, '/courses/');
            const courses = normalizePaginatedResponse<Course>(response).results;
            const course = courses.find(c => c.id === courseId);
            if (!course) throw new Error(`Course with ID ${courseId} not found`);
            return course;
        } catch (error) {
            throw error;
        }
    }

    async getCourseLessons(courseId: string, baseUrl?: string): Promise<Lesson[]> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            const response = await apiService.get<any>(url, `/lessons/?course_id=${courseId}`);
            return normalizePaginatedResponse<Lesson>(response).results;
        } catch (error) {
            throw error;
        }
    }

    async getLesson(lessonId: string, baseUrl?: string): Promise<Lesson> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            return await apiService.get<Lesson>(url, `/lessons/${lessonId}/`);
        } catch (error) {
            throw error;
        }
    }

    async getCourseComments(courseId: string, baseUrl?: string): Promise<Comment[]> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            const response = await apiService.get<any>(url, `/comments/?course_id=${courseId}`);
            return normalizePaginatedResponse<Comment>(response).results;
        } catch (error) {
            throw error;
        }
    }

    async createComment(commentData: Partial<Comment>, baseUrl?: string): Promise<Comment> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            const serviceRegistry = await import('./config').then(m => m.serviceRegistry);
            serviceRegistry.clearCache();

            const commentPayload = {
                external_comment_id: commentData.external_comment_id,
                content: commentData.content,
                user_id: commentData.user_id,
                course_external_id: commentData.course,
            };

            try {
                return await apiService.post<Comment>(url, '/comments/', commentPayload);
            } catch (error: any) {
                if (error.status === 404 || error.status === 400) {
                    return await apiService.post<Comment>(url, '/api/sync/comments/', commentPayload);
                }
                throw error;
            }
        } catch (error) {
            throw error;
        }
    }

    async updateComment(commentId: string, commentData: Partial<Comment>, baseUrl?: string): Promise<Comment> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            return await apiService.put<Comment>(url, `/comments/${commentId}/`, commentData);
        } catch (error) {
            throw error;
        }
    }

    async deleteComment(commentId: string, baseUrl?: string): Promise<void> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            const serviceRegistry = await import('./config').then(m => m.serviceRegistry);
            serviceRegistry.clearCache();
            await apiService.delete(url, `/comments/${commentId}/`);
        } catch (error: any) {
            if (error.status === 404) {
                try {
                    await apiService.delete(url, `/api/sync/comments/${commentId}/`);
                    return;
                } catch (syncError) {
                    // ignore
                }
            }
            throw error;
        }
    }

    async getLessonHomeworks(lessonId: string, baseUrl?: string): Promise<Homework[]> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            const response = await apiService.get<any>(url, `/homeworks/?lesson_id=${lessonId}`);
            return normalizePaginatedResponse<Homework>(response).results;
        } catch (error) {
            throw error;
        }
    }

    async getHomework(homeworkId: string, baseUrl?: string): Promise<Homework> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            return await apiService.get<Homework>(url, `/homeworks/${homeworkId}/`);
        } catch (error) {
            throw error;
        }
    }

    async getHomeworkByExternalId(externalHomeworkId: string, baseUrl?: string): Promise<Homework> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            return await apiService.get<Homework>(url, `/homeworks/${externalHomeworkId}/`);
        } catch (error) {
            throw error;
        }
    }

    async submitHomework(submissionData: Partial<SubmittedHomework>, baseUrl?: string): Promise<SubmittedHomework> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            const homeworkExternalId = submissionData.homework_external_id || submissionData.homework as string;
            const payload: any = {
                external_submitted_homework_id: submissionData.external_submitted_homework_id,
                user_id: submissionData.user_id,
                submitted_homework_url: submissionData.submitted_homework_url,
                description: submissionData.description,
            };
            if (homeworkExternalId) {
                payload.homework_external_id = homeworkExternalId;
            }
            return await apiService.post<SubmittedHomework>(url, '/submitted-homeworks/', payload);
        } catch (error) {
            throw error;
        }
    }

    async getHomeworkById(homeworkId: number, baseUrl?: string): Promise<Homework> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            const response = await apiService.get<any>(url, '/homeworks/');
            const homeworks = normalizePaginatedResponse<Homework>(response).results;
            const homework = homeworks.find(h => h.id === homeworkId);
            if (!homework) throw new Error(`Homework with ID ${homeworkId} not found`);
            return homework;
        } catch (error) {
            throw error;
        }
    }

    async updateHomeworkSubmission(submissionId: string, submissionData: Partial<SubmittedHomework>, baseUrl?: string): Promise<SubmittedHomework> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            const updatePayload: any = {
                external_submitted_homework_id: submissionData.external_submitted_homework_id,
                user_id: submissionData.user_id,
                submitted_homework_url: submissionData.submitted_homework_url,
                description: submissionData.description,
            };

            if (submissionData.homework !== undefined) {
                if (typeof submissionData.homework === 'number') {
                    updatePayload.homework = submissionData.homework;
                } else if (typeof submissionData.homework === 'string') {
                    if (submissionData.homework.includes('-')) {
                        updatePayload.homework_external_id = submissionData.homework;
                    } else {
                        updatePayload.homework = parseInt(submissionData.homework);
                    }
                }
            } else if (submissionData.homework_external_id) {
                updatePayload.homework_external_id = submissionData.homework_external_id;
            }

            return await apiService.put<SubmittedHomework>(url, `/submitted-homeworks/${submissionId}/`, updatePayload);
        } catch (error) {
            throw error;
        }
    }

    async getUserSubmissions(userId: string, homeworkId?: string, baseUrl?: string): Promise<SubmittedHomework[]> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            const query = homeworkId ? `?user_id=${userId}&homework_id=${homeworkId}` : `?user_id=${userId}`;
            const response = await apiService.get<any>(url, `/submitted-homeworks/${query}`);
            return normalizePaginatedResponse<SubmittedHomework>(response).results;
        } catch (error) {
            throw error;
        }
    }

    async getUserSubmissionForHomework(userId: string, homeworkExternalId: string, baseUrl?: string): Promise<SubmittedHomework | null> {
        try {
            const submissions = await this.getUserSubmissions(userId, homeworkExternalId, baseUrl);
            return submissions.length > 0 ? submissions[0] : null;
        } catch (error) {
            return null;
        }
    }

    async getUserRegistrations(userId: string, baseUrl?: string): Promise<CourseRegistration[]> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            const response = await apiService.get<any>(url, `/registrations/?user_id=${userId}`);
            return normalizePaginatedResponse<CourseRegistration>(response).results;
        } catch (error) {
            throw error;
        }
    }

    async isUserRegisteredForCourse(userId: string, courseId: string, baseUrl?: string): Promise<boolean> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            const registrations = await this.getUserRegistrations(userId, url);
            return registrations.some(reg => reg.course_external_id === courseId || reg.course === courseId);
        } catch (error) {
            return false;
        }
    }

    async registerUserForCourse(userId: string, courseExternalId: string, baseUrl?: string): Promise<CourseRegistration> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        try {
            const registrationData = {
                user_id: userId,
                course_external_id: courseExternalId,
                external_id: `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
            return await apiService.post<CourseRegistration>(url, '/register-user/', registrationData);
        } catch (error) {
            throw error;
        }
    }
}

export const courseService = new CourseService();
