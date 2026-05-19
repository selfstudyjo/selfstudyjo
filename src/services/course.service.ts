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
    private readonly APP_ID = parseInt(import.meta.env.VITE_COURSE_APP_ID || '19');

    async getCourseReplicas(): Promise<string[]> {
        return serviceRegistry.getServiceReplicas(this.APP_ID, 'course');
    }

    async getRandomCourseReplica(): Promise<string | null> {
        const replicas = await this.getCourseReplicas();
        return serviceRegistry.getRandomReplica(replicas);
    }

    async getHomeworksForCourse(courseId: string, baseUrl?: string): Promise<Homework[]> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        try {
            const response = await apiService.get<any>(url, `/homeworks/?course_id=${courseId}`);
            return normalizePaginatedResponse<Homework>(response).results;
        } catch (error) {
            console.error('Failed to fetch homeworks for course:', error);
            return [];
        }
    }

    async getCourses(filters?: CourseFilters, baseUrl?: string): Promise<PaginatedResponse<Course>> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        const params = new URLSearchParams();
        if (filters?.search) params.append('search', filters.search);
        if (filters?.page) params.append('page', filters.page.toString());
        if (filters?.page_size) params.append('page_size', filters.page_size.toString());
        if (filters?.ordering) params.append('ordering', filters.ordering);
        const query = params.toString();
        const endpoint = query ? `/courses/?${query}` : '/courses/';
        const response = await apiService.get<any>(url, endpoint);
        return normalizePaginatedResponse<Course>(response);
    }

    async getCourse(courseId: string, baseUrl?: string): Promise<Course> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        return await apiService.get<Course>(url, `/courses/${courseId}/`);
    }

    async getCourseById(courseId: number, baseUrl?: string): Promise<Course> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        const response = await apiService.get<any>(url, '/courses/');
        const courses = normalizePaginatedResponse<Course>(response).results;
        const course = courses.find(c => c.id === courseId);
        if (!course) throw new Error(`Course with ID ${courseId} not found`);
        return course;
    }

    async getCourseLessons(courseId: string, baseUrl?: string): Promise<Lesson[]> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        const response = await apiService.get<any>(url, `/lessons/?course_id=${courseId}`);
        return normalizePaginatedResponse<Lesson>(response).results;
    }

    async getLesson(lessonId: string, baseUrl?: string): Promise<Lesson> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        return await apiService.get<Lesson>(url, `/lessons/${lessonId}/`);
    }

    async getCourseComments(courseId: string, baseUrl?: string): Promise<Comment[]> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        const response = await apiService.get<any>(url, `/comments/?course_id=${courseId}`);
        return normalizePaginatedResponse<Comment>(response).results;
    }

    async createComment(commentData: Partial<Comment>, baseUrl?: string): Promise<Comment> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        const reg = await import('./config').then(m => m.serviceRegistry);
        reg.clearCache();
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
    }

    async updateComment(commentId: string, commentData: Partial<Comment>, baseUrl?: string): Promise<Comment> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        return await apiService.put<Comment>(url, `/comments/${commentId}/`, commentData);
    }

    async deleteComment(commentId: string, baseUrl?: string): Promise<void> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        const reg = await import('./config').then(m => m.serviceRegistry);
        reg.clearCache();
        try {
            await apiService.delete(url, `/comments/${commentId}/`);
        } catch (error: any) {
            if (error.status === 404) {
                try {
                    await apiService.delete(url, `/api/sync/comments/${commentId}/`);
                    return;
                } catch (syncError) {}
            }
            throw error;
        }
    }

    async getLessonHomeworks(lessonId: string, baseUrl?: string): Promise<Homework[]> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        const response = await apiService.get<any>(url, `/homeworks/?lesson_id=${lessonId}`);
        return normalizePaginatedResponse<Homework>(response).results;
    }

    async getHomework(homeworkId: string, baseUrl?: string): Promise<Homework> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        return await apiService.get<Homework>(url, `/homeworks/${homeworkId}/`);
    }

    async getHomeworkByExternalId(externalHomeworkId: string, baseUrl?: string): Promise<Homework> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        return await apiService.get<Homework>(url, `/homeworks/${externalHomeworkId}/`);
    }

    async submitHomework(submissionData: Partial<SubmittedHomework>, baseUrl?: string): Promise<SubmittedHomework> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        const homeworkExternalId = submissionData.homework_external_id || submissionData.homework as string;
        const payload: any = {
            external_submitted_homework_id: submissionData.external_submitted_homework_id,
            user_id: submissionData.user_id,
            submitted_homework_url: submissionData.submitted_homework_url,
            description: submissionData.description,
        };
        if (homeworkExternalId) payload.homework_external_id = homeworkExternalId;
        return await apiService.post<SubmittedHomework>(url, '/submitted-homeworks/', payload);
    }

    async getHomeworkById(homeworkId: number, baseUrl?: string): Promise<Homework> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        const response = await apiService.get<any>(url, '/homeworks/');
        const homeworks = normalizePaginatedResponse<Homework>(response).results;
        const homework = homeworks.find(h => h.id === homeworkId);
        if (!homework) throw new Error(`Homework with ID ${homeworkId} not found`);
        return homework;
    }

    async updateHomeworkSubmission(submissionId: string, submissionData: Partial<SubmittedHomework>, baseUrl?: string): Promise<SubmittedHomework> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
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
    }

    async getUserSubmissions(userId: string, homeworkId?: string, baseUrl?: string): Promise<SubmittedHomework[]> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        const query = homeworkId
            ? `?user_id=${encodeURIComponent(userId)}&homework_id=${encodeURIComponent(homeworkId)}`
            : `?user_id=${encodeURIComponent(userId)}`;
        const response = await apiService.get<any>(url, `/submitted-homeworks/${query}`);
        return normalizePaginatedResponse<SubmittedHomework>(response).results;
    }

    async getUserSubmissionForHomework(userId: string, homeworkExternalId: string, baseUrl?: string): Promise<SubmittedHomework | null> {
        try {
            const submissions = await this.getUserSubmissions(userId, homeworkExternalId, baseUrl);
            return submissions.length > 0 ? submissions[0] : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Fetch registrations from the DEPLOYED selfstudy-course backend.
     * Accepts a single user id or an array of user ids (e.g. UUID + username),
     * queries the backend for each, merges and deduplicates results.
     *
     * This is critical because historically the `user_id` field on the backend
     * has been written sometimes as the user UUID and sometimes as the username.
     */
    async getUserRegistrations(
        userId: string | string[],
        baseUrl?: string
    ): Promise<CourseRegistration[]> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');

        const rawIds = Array.isArray(userId) ? userId : [userId];
        const ids = [...new Set(rawIds.filter(Boolean).map(s => String(s).trim()))];

        if (ids.length === 0) return [];

        const all: CourseRegistration[] = [];
        await Promise.all(
            ids.map(async (id) => {
                try {
                    const response = await apiService.get<any>(
                        url,
                        `/registrations/?user_id=${encodeURIComponent(id)}`
                    );
                    const regs = normalizePaginatedResponse<CourseRegistration>(response).results;
                    all.push(...regs);
                } catch (err) {
                    console.warn(`getUserRegistrations: failed for user_id=${id}`, err);
                }
            })
        );

        // Deduplicate by external_id (or id) since multiple identifiers may return overlapping rows
        const seen = new Set<string | number>();
        return all.filter(r => {
            const key = r.external_id ?? r.id ?? `${r.user_id}_${r.course_external_id || r.course}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    async isUserRegisteredForCourse(
        userId: string | string[],
        courseId: string,
        baseUrl?: string
    ): Promise<boolean> {
        try {
            const registrations = await this.getUserRegistrations(userId, baseUrl);
            return registrations.some(
                reg =>
                    reg.course_external_id === courseId ||
                    reg.course === courseId
            );
        } catch (error) {
            return false;
        }
    }

    async getUserRegistrationForCourse(
        userId: string | string[],
        courseExternalId: string,
        baseUrl?: string
    ): Promise<CourseRegistration | null> {
        try {
            const registrations = await this.getUserRegistrations(userId, baseUrl);
            return (
                registrations.find(
                    reg =>
                        reg.course_external_id === courseExternalId ||
                        reg.course === courseExternalId
                ) || null
            );
        } catch (error) {
            return null;
        }
    }

    async registerUserForCourse(
        userId: string,
        courseExternalId: string,
        baseUrl?: string
    ): Promise<CourseRegistration> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        const registrationData = {
            user_id: userId,
            course_external_id: courseExternalId,
            external_id: `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        return await apiService.post<CourseRegistration>(url, '/register-user/', registrationData);
    }

    /**
     * Delete a registration record by its external_id via
     * DELETE /registrations/<external_id>/ on the deployed selfstudy-course app.
     */
    async unregisterUserFromCourse(
        registrationExternalId: string,
        baseUrl?: string
    ): Promise<void> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        const reg = await import('./config').then(m => m.serviceRegistry);
        reg.clearCache();
        await apiService.delete(url, `/registrations/${registrationExternalId}/`);
    }

    /**
     * Look up a registration for the given user/course (trying multiple user ids)
     * and delete it. Returns true if a registration was found and removed.
     */
    async unregisterUserFromCourseByCourse(
        userId: string | string[],
        courseExternalId: string,
        baseUrl?: string
    ): Promise<boolean> {
        const url = baseUrl || await this.getRandomCourseReplica();
        if (!url) throw new Error('No course service replicas available');
        const registration = await this.getUserRegistrationForCourse(userId, courseExternalId, url);
        if (!registration?.external_id) return false;
        await this.unregisterUserFromCourse(registration.external_id, url);
        return true;
    }
}

export const courseService = new CourseService();