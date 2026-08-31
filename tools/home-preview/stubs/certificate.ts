// Stands in for `@/services/certificate.service` in the dashboard preview.
export type { CourseCertificate, ExamCertificate } from '../../../src/services/certificate.service';
import type { CourseCertificate, ExamCertificate } from '../../../src/services/certificate.service';

const EMPTY = new URLSearchParams(location.search).has('empty');

const EXAM: ExamCertificate[] = [
    { certificate_id: 'c-1', exam_id: 'exam-net', user_id: 'u-preview', taken_date: '2026-07-14T10:00:00Z', expire_date: '2029-07-14T10:00:00Z', created_at: '2026-07-14T10:00:00Z', is_valid: true },
    // Expired, so the "Valid / Expired" pill has both states on screen at once.
    { certificate_id: 'c-2', exam_id: 'exam-web', user_id: 'u-preview', taken_date: '2024-01-09T10:00:00Z', expire_date: '2025-01-09T10:00:00Z', created_at: '2024-01-09T10:00:00Z', is_valid: false },
];

const COURSE: CourseCertificate[] = [
    { certificate_id: 'c-3', course_id: 'course-web', user_id: 'u-preview', date: '2026-05-02T10:00:00Z', hours: 42, created_at: '2026-05-02T10:00:00Z' },
];

const delay = <T,>(v: T, ms = 90): Promise<T> => new Promise(r => setTimeout(() => r(v), ms));

export const certificateService = {
    getExamCertificates: (_f: unknown) => delay(EMPTY ? [] : EXAM),
    getCourseCertificates: (_f: unknown) => delay(EMPTY ? [] : COURSE),
};
