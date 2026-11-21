/**
 * Per-course permissions on the pages a student opens directly (2026-11-21).
 *
 * Returns a redirect to /locked when the course's operator restricted the part
 * of the course this route is, else null. It looks a record up (exam, runbook)
 * only when this user has restrictions at all, so for nearly every visit the
 * cost is one cached request.
 */
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { courseAccessService } from '@/services/courseAccess.service';
import { canOpenLab, canUse, hasRestrictions, type CourseComponent } from '@/utils/courseAccess';

function locked(component: CourseComponent, courseId: string, to: RouteLocationNormalized): RouteLocationRaw {
    return { name: 'CourseLocked', query: { part: component, course: courseId, from: to.fullPath } };
}

export async function courseAccessRedirect(to: RouteLocationNormalized): Promise<RouteLocationRaw | null> {
    const names = ['LessonDetails', 'TakeQuiz', 'TakeExam', 'PracticeExam', 'LabWorkspace', 'RunbookDetails'];
    if (!names.includes(String(to.name))) return null;
    const auth = useAuthStore();
    if (auth.isAdmin) return null;
    const access = await courseAccessService.get(auth.user?.id);
    if (!hasRestrictions(access)) return null;

    try {
        switch (to.name) {
            case 'LessonDetails': {
                const courseId = String(to.params.courseId || '');
                return canUse(access, courseId, 'lessons') ? null : locked('lessons', courseId, to);
            }
            case 'TakeQuiz': {
                const courseId = String(to.query.courseId || '');
                return canUse(access, courseId, 'quizzes') ? null : locked('quizzes', courseId, to);
            }
            case 'TakeExam':
            case 'PracticeExam': {
                const examId = String(to.query.examId || '');
                if (!examId) return null;
                const { examService } = await import('@/services/exam.service');
                const exam = await examService.getExam(examId);
                return canUse(access, exam?.course_id, 'exams') ? null : locked('exams', String(exam?.course_id || ''), to);
            }
            case 'LabWorkspace':
                return canOpenLab(access, to.params.labId) ? null : locked('labs', '', to);
            case 'RunbookDetails': {
                const id = Number(to.params.id);
                if (!id) return null;
                const { runbookService } = await import('@/services/runbook.service');
                const runbook = await runbookService.getRunbookById(id);
                return canUse(access, runbook?.course_id, 'runbooks') ? null : locked('runbooks', String(runbook?.course_id || ''), to);
            }
        }
    } catch {
        // The record could not be read: the page itself will say so. Never
        // lock somebody out because a lookup failed.
    }
    return null;
}
