import { apiService } from './api';
import { serviceRegistry } from './config';
import { normalizePaginatedResponse } from '@/utils/api-utils';

export interface CourseCertificate {
    certificate_id: string;
    course_id: string;
    user_id: string;
    date: string;
    hours: number;
    message?: string;
    created_at: string;
}

export interface ExamCertificate {
    certificate_id: string;
    exam_id: string;
    user_id: string;
    taken_date: string;
    expire_date: string;
    message?: string;
    created_at: string;
    is_valid?: boolean;
}

export interface UserCertificates {
    course_certificates: CourseCertificate[];
    exam_certificates: ExamCertificate[];
}

export interface CertificateFilters {
    user_id?: string;
    course_id?: string;
    exam_id?: string;
    valid_only?: boolean;
    page?: number;
    page_size?: number;
}

class CertificateService {
    private readonly APP_ID = 24; // From .env VITE_CERTIFICATE_APP_ID

    async getCertificateReplicas(): Promise<string[]> {
        return serviceRegistry.getServiceReplicas(this.APP_ID, 'certificate');
    }

    async getRandomCertificateReplica(): Promise<string | null> {
        const replicas = await this.getCertificateReplicas();
        return serviceRegistry.getRandomReplica(replicas);
    }

    // Get user certificates
    async getUserCertificates(userId: string): Promise<UserCertificates> {
        const baseUrl = await this.getRandomCertificateReplica();
        if (!baseUrl) {
            throw new Error('No certificate service replicas available');
        }

        try {
            const endpoint = `/user-certificates/${userId}/`;
            const response = await apiService.get<UserCertificates>(baseUrl, endpoint);
            return response;
        } catch (error: any) {
            // Fallback: Try to fetch course and exam certificates separately
            try {
                const [courseCerts, examCerts] = await Promise.all([
                    this.getCourseCertificates({ user_id: userId }),
                                                                   this.getExamCertificates({ user_id: userId })
                ]);

                return {
                    course_certificates: courseCerts,
                    exam_certificates: examCerts
                };
            } catch (fallbackError) {
                throw error;
            }
        }
    }

    // Get course certificate by ID
    async getCourseCertificate(certificateId: string): Promise<CourseCertificate> {
        const baseUrl = await this.getRandomCertificateReplica();
        if (!baseUrl) {
            throw new Error('No certificate service replicas available');
        }

        try {
            const endpoint = `/course-certificates/${certificateId}/`;
            return await apiService.get<CourseCertificate>(baseUrl, endpoint);
        } catch (error) {
            throw error;
        }
    }

    // Get exam certificate by ID
    async getExamCertificate(certificateId: string): Promise<ExamCertificate> {
        const baseUrl = await this.getRandomCertificateReplica();
        if (!baseUrl) {
            throw new Error('No certificate service replicas available');
        }

        try {
            const endpoint = `/exam-certificates/${certificateId}/`;
            return await apiService.get<ExamCertificate>(baseUrl, endpoint);
        } catch (error) {
            throw error;
        }
    }

    // Get all course certificates with filters
    async getCourseCertificates(filters?: CertificateFilters): Promise<CourseCertificate[]> {
        const baseUrl = await this.getRandomCertificateReplica();
        if (!baseUrl) {
            throw new Error('No certificate service replicas available');
        }

        try {
            const params = new URLSearchParams();
            if (filters?.user_id) params.append('user_id', filters.user_id);
            if (filters?.course_id) params.append('course_id', filters.course_id);
            if (filters?.page) params.append('page', filters.page.toString());
            if (filters?.page_size) params.append('page_size', filters.page_size.toString());

            const query = params.toString();
            const endpoint = query ? `/course-certificates/?${query}` : '/course-certificates/';

            const response = await apiService.get<any>(baseUrl, endpoint);
            return normalizePaginatedResponse<CourseCertificate>(response).results;
        } catch (error) {
            throw error;
        }
    }

    // Get all exam certificates with filters
    async getExamCertificates(filters?: CertificateFilters): Promise<ExamCertificate[]> {
        const baseUrl = await this.getRandomCertificateReplica();
        if (!baseUrl) {
            throw new Error('No certificate service replicas available');
        }

        try {
            const params = new URLSearchParams();
            if (filters?.user_id) params.append('user_id', filters.user_id);
            if (filters?.exam_id) params.append('exam_id', filters.exam_id);
            if (filters?.valid_only) params.append('valid_only', 'true');
            if (filters?.page) params.append('page', filters.page.toString());
            if (filters?.page_size) params.append('page_size', filters.page_size.toString());

            const query = params.toString();
            const endpoint = query ? `/exam-certificates/?${query}` : '/exam-certificates/';

            const response = await apiService.get<any>(baseUrl, endpoint);
            return normalizePaginatedResponse<ExamCertificate>(response).results;
        } catch (error) {
            throw error;
        }
    }

    // Validate certificate
    async validateCertificate(certificateId: string, type: 'course' | 'exam'): Promise<any> {
        const baseUrl = await this.getRandomCertificateReplica();
        if (!baseUrl) {
            throw new Error('No certificate service replicas available');
        }

        try {
            const endpoint = type === 'course'
            ? `/course-certificates/validate/?certificate_id=${certificateId}`
            : `/exam-certificates/validate/?certificate_id=${certificateId}`;

            return await apiService.get<any>(baseUrl, endpoint);
        } catch (error) {
            throw error;
        }
    }

    // Create course certificate
    async createCourseCertificate(certificateData: Partial<CourseCertificate>): Promise<CourseCertificate> {
        const baseUrl = await this.getRandomCertificateReplica();
        if (!baseUrl) {
            throw new Error('No certificate service replicas available');
        }

        try {
            return await apiService.post<CourseCertificate>(baseUrl, '/course-certificates/', certificateData);
        } catch (error) {
            throw error;
        }
    }

    // Create exam certificate
    async createExamCertificate(certificateData: Partial<ExamCertificate>): Promise<ExamCertificate> {
        const baseUrl = await this.getRandomCertificateReplica();
        if (!baseUrl) {
            throw new Error('No certificate service replicas available');
        }

        try {
            return await apiService.post<ExamCertificate>(baseUrl, '/exam-certificates/', certificateData);
        } catch (error) {
            throw error;
        }
    }

    // Update course certificate
    async updateCourseCertificate(certificateId: string, updateData: Partial<CourseCertificate>): Promise<CourseCertificate> {
        const baseUrl = await this.getRandomCertificateReplica();
        if (!baseUrl) {
            throw new Error('No certificate service replicas available');
        }

        try {
            const endpoint = `/course-certificates/${certificateId}/`;
            return await apiService.put<CourseCertificate>(baseUrl, endpoint, updateData);
        } catch (error) {
            throw error;
        }
    }

    // Update exam certificate
    async updateExamCertificate(certificateId: string, updateData: Partial<ExamCertificate>): Promise<ExamCertificate> {
        const baseUrl = await this.getRandomCertificateReplica();
        if (!baseUrl) {
            throw new Error('No certificate service replicas available');
        }

        try {
            const endpoint = `/exam-certificates/${certificateId}/`;
            return await apiService.put<ExamCertificate>(baseUrl, endpoint, updateData);
        } catch (error) {
            throw error;
        }
    }

    // Delete course certificate
    async deleteCourseCertificate(certificateId: string): Promise<void> {
        const baseUrl = await this.getRandomCertificateReplica();
        if (!baseUrl) {
            throw new Error('No certificate service replicas available');
        }

        try {
            const endpoint = `/course-certificates/${certificateId}/`;
            await apiService.delete(baseUrl, endpoint);
        } catch (error) {
            throw error;
        }
    }

    // Delete exam certificate
    async deleteExamCertificate(certificateId: string): Promise<void> {
        const baseUrl = await this.getRandomCertificateReplica();
        if (!baseUrl) {
            throw new Error('No certificate service replicas available');
        }

        try {
            const endpoint = `/exam-certificates/${certificateId}/`;
            await apiService.delete(baseUrl, endpoint);
        } catch (error) {
            throw error;
        }
    }
}

export const certificateService = new CertificateService();
