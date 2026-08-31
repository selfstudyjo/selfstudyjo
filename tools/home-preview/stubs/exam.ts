// Stands in for `@/services/exam.service` in the dashboard preview.
export type { Exam } from '../../../src/services/exam.service';
import type { Exam } from '../../../src/services/exam.service';

const EXAMS: Record<string, Exam> = {
    'exam-net': { external_id: 'exam-net', title: 'Networking Fundamentals — Final', course_id: 'course-net', exam_duration: 90, exam_instructions: '', video_instructions_url: '' },
    'exam-web': { external_id: 'exam-web', title: 'Web Technologies — Final', course_id: 'course-web', exam_duration: 120, exam_instructions: '', video_instructions_url: '' },
};

export const examService = {
    getExam: (id: string) => EXAMS[id]
        ? Promise.resolve(EXAMS[id])
        : Promise.reject(new Error(`preview: no exam ${id}`)),
};
