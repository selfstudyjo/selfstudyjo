// Stands in for `@/services/course.service` in the dashboard preview.
//
// The DATA is deliberately awkward, because a preview fed tidy data is a
// preview that proves nothing (working rule 44 — a stub kinder than production
// tests nothing). So: a 74-character course title, an Arabic one, a course with
// no quiz activity at all, a homework with no description, and one course whose
// record never arrives so the progress row has to fall back.
//
// Types are re-exported from the REAL module with `export type`, which TypeScript
// erases — so nothing here pulls the live service, its registry lookup or its
// token into the preview bundle.
export type {
    Course,
    CourseFilters,
    CourseRegistration,
    Homework,
    Lesson,
} from '../../../src/services/course.service';

import type { Course, CourseRegistration, Homework, Lesson } from '../../../src/services/course.service';

const EMPTY = new URLSearchParams(location.search).has('empty');

/** A course whose record deliberately never resolves — see `courseTitleFor`. */
export const MISSING_COURSE_ID = 'course-ghost';

const COURSES: Record<string, Course> = {
    'course-web': {
        external_course_id: 'course-web',
        title: 'Web Technologies: Django, HTTP and the Modern Front End',
        description: 'Building dynamic, database-driven websites.',
        image_url: '',
        translations: { ar: { title: 'تقنيات الويب: جانغو وHTTP والواجهات الحديثة' } },
    },
    'course-net': {
        external_course_id: 'course-net',
        title: 'Networking Fundamentals',
        description: 'Switching, routing, VLANs and subnetting.',
        image_url: '',
        translations: { ar: { title: 'أساسيات الشبكات' }, zh: { title: '网络基础' } },
    },
    'course-sec': {
        external_course_id: 'course-sec',
        title: 'Information Security Fundamentals',
        description: 'Threats, controls and the basics of cryptography.',
        image_url: '',
    },
};

const REGISTRATIONS: CourseRegistration[] = [
    { external_id: 'reg-1', user_id: 'u-preview', course: 'course-web', course_external_id: 'course-web', date_registered: '2026-03-04T09:00:00Z' },
    { external_id: 'reg-2', user_id: 'u-preview', course: 'course-net', course_external_id: 'course-net', date_registered: '2026-06-19T09:00:00Z' },
    // No quizzes taken on this one: the row that must still appear.
    { external_id: 'reg-3', user_id: 'u-preview', course: 'course-sec', course_external_id: 'course-sec', date_registered: '2026-08-27T09:00:00Z' },
    // And one whose course record 404s.
    { external_id: 'reg-4', user_id: 'u-preview', course: MISSING_COURSE_ID, course_external_id: MISSING_COURSE_ID, date_registered: '2026-08-30T09:00:00Z' },
];

const LESSONS: Record<string, Lesson[]> = {
    'course-web': [
        { external_lesson_id: 'l-web-1', title: 'Module 1 — HTTP requests and responses' },
        { external_lesson_id: 'l-web-2', title: 'Module 2 — Templates' },
    ],
    'course-net': [
        { external_lesson_id: 'l-net-1', title: 'Lecture 3 — VLANs' },
    ],
    'course-sec': [],
    [MISSING_COURSE_ID]: [],
};

const HOMEWORKS: Record<string, Homework[]> = {
    'l-web-1': [
        { external_homework_id: 'hw-1', title: 'Build a request logger', description: 'Log every request method, path and status to a file, then summarise the results.' },
        // No description at all — `truncateText` has a branch for it.
        { external_homework_id: 'hw-2', title: 'Template inheritance', description: '' },
    ],
    'l-web-2': [
        { external_homework_id: 'hw-3', title: 'A base template for the whole site', description: 'One base.html, three pages extending it.', translations: { ar: { title: 'قالب أساسي للموقع بالكامل' } } },
    ],
    'l-net-1': [
        { external_homework_id: 'hw-4', title: 'Configure two VLANs and a trunk', description: 'switchport mode trunk, and prove it with a ping across the two.' },
    ],
};

const delay = <T,>(value: T, ms = 60): Promise<T> =>
    new Promise(resolve => setTimeout(() => resolve(value), ms));

export const courseService = {
    getUserRegistrations: (_userId: string) => delay(EMPTY ? [] : REGISTRATIONS, 120),
    getCourse: (id: string) => COURSES[id]
        ? delay(COURSES[id])
        : Promise.reject(new Error(`preview: no course ${id}`)),
    getCourseLessons: (courseId: string) => delay(LESSONS[courseId] ?? []),
    getLessonHomeworks: (lessonId: string) => delay(EMPTY ? [] : (HOMEWORKS[lessonId] ?? [])),
    getLesson: (id: string) => {
        for (const list of Object.values(LESSONS)) {
            const found = list.find(l => l.external_lesson_id === id);
            if (found) return delay(found);
        }
        return Promise.reject(new Error(`preview: no lesson ${id}`));
    },
};
