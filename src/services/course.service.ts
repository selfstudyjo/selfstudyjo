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
    homework: string | number; // Allow both string and number
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

    // Courses
    async getCourses(filters?: CourseFilters): Promise<PaginatedResponse<Course>> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            const params = new URLSearchParams();
            if (filters?.search) params.append('search', filters.search);
            if (filters?.page) params.append('page', filters.page.toString());
            if (filters?.page_size) params.append('page_size', filters.page_size.toString());
            if (filters?.ordering) params.append('ordering', filters.ordering);

            const query = params.toString();
            const endpoint = query ? `/courses/?${query}` : '/courses/';

            console.log('🔍 [CourseService] Fetching courses from:', `${baseUrl}${endpoint}`);
            console.log('📋 [CourseService] Filters:', filters);

            const response = await apiService.get<any>(baseUrl, endpoint);

            console.log('✅ [CourseService] Response received:', {
                count: response.count,
                resultsLength: response.results?.length,
                next: response.next,
                previous: response.previous
            });

            return normalizePaginatedResponse<Course>(response);
        } catch (error) {
            console.error('❌ [CourseService] Failed to fetch courses:', error);
            throw error;
        }
    }

    async getCourse(courseId: string): Promise<Course> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            return await apiService.get<Course>(baseUrl, `/courses/${courseId}/`);
        } catch (error) {
            console.error('Failed to fetch course:', error);
            throw error;
        }
    }

    // Get course by ID (internal ID)
    async getCourseById(courseId: number): Promise<Course> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            // First get all courses and find by internal ID
            const response = await apiService.get<any>(baseUrl, '/courses/');
            const courses = normalizePaginatedResponse<Course>(response).results;
            const course = courses.find(c => c.id === courseId);
            if (!course) throw new Error(`Course with ID ${courseId} not found`);
            return course;
        } catch (error) {
            console.error('Failed to fetch course by ID:', error);
            throw error;
        }
    }

    // Lessons
    async getCourseLessons(courseId: string): Promise<Lesson[]> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            const response = await apiService.get<any>(baseUrl, `/lessons/?course_id=${courseId}`);
            return normalizePaginatedResponse<Lesson>(response).results;
        } catch (error) {
            console.error('Failed to fetch course lessons:', error);
            throw error;
        }
    }

    async getLesson(lessonId: string): Promise<Lesson> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            return await apiService.get<Lesson>(baseUrl, `/lessons/${lessonId}/`);
        } catch (error) {
            console.error('Failed to fetch lesson:', error);
            throw error;
        }
    }

    // Comments
    async getCourseComments(courseId: string): Promise<Comment[]> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            const response = await apiService.get<any>(baseUrl, `/comments/?course_id=${courseId}`);
            return normalizePaginatedResponse<Comment>(response).results;
        } catch (error) {
            console.error('Failed to fetch course comments:', error);
            throw error;
        }
    }

    async createComment(commentData: Partial<Comment>): Promise<Comment> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            console.log('Creating comment with data:', commentData);

            // Clear cache for fresh replica
            const serviceRegistry = await import('./config').then(m => m.serviceRegistry);
            serviceRegistry.clearCache();

            // The backend expects course_external_id
            const commentPayload = {
                external_comment_id: commentData.external_comment_id,
                content: commentData.content,
                user_id: commentData.user_id,
                course_external_id: commentData.course, // Pass the external course ID
            };

            console.log('Sending comment payload:', commentPayload);

            // Try to post to comments endpoint
            try {
                const response = await apiService.post<Comment>(baseUrl, '/comments/', commentPayload);
                console.log('Comment created successfully:', response);
                return response;
            } catch (error: any) {
                // If that fails, try the sync endpoint
                if (error.status === 404 || error.status === 400) {
                    console.log('Trying alternative endpoint...');
                    const response = await apiService.post<Comment>(baseUrl, '/api/sync/comments/', commentPayload);
                    console.log('Comment created via sync endpoint:', response);
                    return response;
                }
                throw error;
            }
        } catch (error: any) {
            console.error('Failed to create comment:', error);
            console.error('Error details:', error.data || error.message);
            throw error;
        }
    }

    async updateComment(commentId: string, commentData: Partial<Comment>): Promise<Comment> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            return await apiService.put<Comment>(baseUrl, `/comments/${commentId}/`, commentData);
        } catch (error) {
            console.error('Failed to update comment:', error);
            throw error;
        }
    }

    async deleteComment(commentId: string): Promise<void> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            // Clear cache for fresh replica
            const serviceRegistry = await import('./config').then(m => m.serviceRegistry);
            serviceRegistry.clearCache();

            await apiService.delete(baseUrl, `/comments/${commentId}/`);
            console.log(`Comment ${commentId} deleted successfully`);
        } catch (error: any) {
            console.error('Failed to delete comment:', error);

            // If that fails, try alternative endpoint
            if (error.status === 404) {
                try {
                    await apiService.delete(baseUrl, `/api/sync/comments/${commentId}/`);
                    console.log(`Comment ${commentId} deleted via sync endpoint`);
                    return;
                } catch (syncError) {
                    console.error('Failed to delete comment via sync endpoint:', syncError);
                }
            }

            throw error;
        }
    }

    // Homeworks
    async getLessonHomeworks(lessonId: string): Promise<Homework[]> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            const response = await apiService.get<any>(baseUrl, `/homeworks/?lesson_id=${lessonId}`);
            return normalizePaginatedResponse<Homework>(response).results;
        } catch (error) {
            console.error('Failed to fetch lesson homeworks:', error);
            throw error;
        }
    }

    async getHomework(homeworkId: string): Promise<Homework> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            return await apiService.get<Homework>(baseUrl, `/homeworks/${homeworkId}/`);
        } catch (error) {
            console.error('Failed to fetch homework:', error);
            throw error;
        }
    }

    async getHomeworkByExternalId(externalHomeworkId: string): Promise<Homework> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            return await apiService.get<Homework>(baseUrl, `/homeworks/${externalHomeworkId}/`);
        } catch (error) {
            console.error('Failed to fetch homework by external ID:', error);
            throw error;
        }
    }

    // Submissions - FIXED for sync
    async submitHomework(submissionData: Partial<SubmittedHomework>): Promise<SubmittedHomework> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            console.log('Submitting homework to:', baseUrl);
            console.log('Submission data:', submissionData);

            // For proper sync, use the homework's external ID
            const homeworkExternalId = submissionData.homework_external_id || submissionData.homework as string;

            // Make sure we're sending the correct data structure for sync
            const payload: any = {
                external_submitted_homework_id: submissionData.external_submitted_homework_id,
                user_id: submissionData.user_id,
                submitted_homework_url: submissionData.submitted_homework_url,
                description: submissionData.description,
            };

            // Add homework_external_id for sync compatibility
            if (homeworkExternalId) {
                payload.homework_external_id = homeworkExternalId;
            }

            console.log('Sending payload for sync:', payload);

            // Use the submitted-homeworks endpoint for proper sync handling
            return await apiService.post<SubmittedHomework>(baseUrl, '/submitted-homeworks/', payload);
        } catch (error: any) {
            console.error('Failed to submit homework:', error);
            console.error('Error details:', error.data || error.message);
            throw error;
        }
    }

    // Helper method to get homework by internal ID
    async getHomeworkById(homeworkId: number): Promise<Homework> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            // Fetch all homeworks and find by ID
            const response = await apiService.get<any>(baseUrl, '/homeworks/');
            const homeworks = normalizePaginatedResponse<Homework>(response).results;
            const homework = homeworks.find(h => h.id === homeworkId);
            if (!homework) throw new Error(`Homework with ID ${homeworkId} not found`);
            return homework;
        } catch (error) {
            console.error('Failed to fetch homework by ID:', error);
            throw error;
        }
    }

    async updateHomeworkSubmission(submissionId: string, submissionData: Partial<SubmittedHomework>): Promise<SubmittedHomework> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            console.log('Updating submission ID:', submissionId);
            console.log('Update data:', submissionData);

            // For updates, we need to structure the data properly based on what the backend expects
            const updatePayload: any = {
                external_submitted_homework_id: submissionData.external_submitted_homework_id,
                user_id: submissionData.user_id,
                submitted_homework_url: submissionData.submitted_homework_url,
                description: submissionData.description,
            };

            // Handle homework field - check if it's a number (internal ID) or string (external ID)
            if (submissionData.homework !== undefined) {
                if (typeof submissionData.homework === 'number') {
                    // If it's a number, send as homework (internal ID)
                    updatePayload.homework = submissionData.homework;
                } else if (typeof submissionData.homework === 'string') {
                    // If it's a string, check if it's an external ID format (contains hyphen)
                    if (submissionData.homework.includes('-')) {
                        // External ID, send as homework_external_id
                        updatePayload.homework_external_id = submissionData.homework;
                    } else {
                        // Might be a string representation of internal ID
                        updatePayload.homework = parseInt(submissionData.homework);
                    }
                }
            } else if (submissionData.homework_external_id) {
                // Use homework_external_id if provided
                updatePayload.homework_external_id = submissionData.homework_external_id;
            }

            console.log('Sending update payload:', updatePayload);
            return await apiService.put<SubmittedHomework>(baseUrl, `/submitted-homeworks/${submissionId}/`, updatePayload);
        } catch (error) {
            console.error('Failed to update homework submission:', error);
            throw error;
        }
    }

    async getUserSubmissions(userId: string, homeworkId?: string): Promise<SubmittedHomework[]> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            const query = homeworkId ? `?user_id=${userId}&homework_id=${homeworkId}` : `?user_id=${userId}`;
            const response = await apiService.get<any>(baseUrl, `/submitted-homeworks/${query}`);
            return normalizePaginatedResponse<SubmittedHomework>(response).results;
        } catch (error) {
            console.error('Failed to fetch user submissions:', error);
            throw error;
        }
    }

    async getUserSubmissionForHomework(userId: string, homeworkExternalId: string): Promise<SubmittedHomework | null> {
        try {
            const submissions = await this.getUserSubmissions(userId, homeworkExternalId);
            return submissions.length > 0 ? submissions[0] : null;
        } catch (error) {
            console.error('Failed to fetch user submission for homework:', error);
            return null;
        }
    }

    // Registrations
    async getUserRegistrations(userId: string): Promise<CourseRegistration[]> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            const response = await apiService.get<any>(baseUrl, `/registrations/?user_id=${userId}`);
            return normalizePaginatedResponse<CourseRegistration>(response).results;
        } catch (error) {
            console.error('Failed to fetch user registrations:', error);
            throw error;
        }
    }

    async isUserRegisteredForCourse(userId: string, courseId: string): Promise<boolean> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            const registrations = await this.getUserRegistrations(userId);
            return registrations.some(reg => reg.course_external_id === courseId || reg.course === courseId);
        } catch (error) {
            console.error('Failed to check registration:', error);
            return false;
        }
    }

    async registerUserForCourse(userId: string, courseExternalId: string): Promise<CourseRegistration> {
        const baseUrl = await this.getRandomCourseReplica();
        if (!baseUrl) {
            throw new Error('No course service replicas available');
        }

        try {
            const registrationData = {
                user_id: userId,
                course_external_id: courseExternalId,
                external_id: `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };

            return await apiService.post<CourseRegistration>(baseUrl, '/register-user/', registrationData);
        } catch (error) {
            console.error('Failed to register user for course:', error);
            throw error;
        }
    }
}

export const courseService = new CourseService();
