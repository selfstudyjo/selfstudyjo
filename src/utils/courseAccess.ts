/**
 * Per-course permissions - the decisions (2026-11-21). Plain: no Vue, no DOM.
 *
 * App 19 answers GET /course-access/?user_id= with ONLY the restricted courses
 * (a course absent from `courses` allows everything) and `denied_labs`, the lab
 * ids linked from lessons of courses whose labs this user may not open. The
 * operator edits the policy in selfstudyadmin -> Courses -> Permissions.
 *
 * Default is OPEN: no policy, a failed request, or an admin -> allowed. A cold
 * app 19 must not lock every student out of a platform whose courses it also
 * serves; restrictions are an exception the operator adds.
 */
export type CourseComponent = 'lessons' | 'labs' | 'exams' | 'quizzes' | 'runbooks';

export interface CourseAccess {
    courses: Record<string, Partial<Record<CourseComponent, boolean>>>;
    denied_labs: string[];
}

export const OPEN_ACCESS: CourseAccess = { courses: {}, denied_labs: [] };

/** App 19's spelling of a course id: lowercase, hyphens stripped. */
export function courseKey(id: unknown): string {
    return String(id ?? '').trim().toLowerCase().replace(/-/g, '');
}

export function hasRestrictions(access: CourseAccess | null | undefined): boolean {
    return !!access && (Object.keys(access.courses || {}).length > 0 || (access.denied_labs || []).length > 0);
}

export function canUse(access: CourseAccess | null | undefined, courseId: unknown,
                       component: CourseComponent): boolean {
    if (!access || !courseId) return true;
    const verdict = access.courses?.[courseKey(courseId)];
    if (!verdict) return true;
    return verdict[component] !== false;
}

export function canOpenLab(access: CourseAccess | null | undefined, labId: unknown): boolean {
    if (!access || !labId) return true;
    return !(access.denied_labs || []).includes(String(labId));
}
