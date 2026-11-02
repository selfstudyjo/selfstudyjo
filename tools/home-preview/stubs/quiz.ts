// Stands in for `@/services/quiz.service` in the dashboard preview.
//
// The awkward part is on purpose: `q-http` is RE-SAT THREE TIMES, at 41, 62 and
// 88. `bestPerQuiz` has to collapse those to one row at 88, or the dashboard
// reports "4 quizzes passed" to somebody who has passed two and drags their
// average down with their own early attempts. `q-vlan` is undated, which is the
// tie-break branch. And nothing here belongs to `course-sec`, so that course's
// progress row has to render its "no quizzes yet" state.
export type { Quiz, UserQuizAnswer, UserQuizResult } from '../../../src/services/quiz.service';
import type { Quiz, UserQuizResult } from '../../../src/services/quiz.service';

const EMPTY = new URLSearchParams(location.search).has('empty');

const RESULTS: UserQuizResult[] = [
    { external_id: 'r-1', user_id: 'u-preview', username: 'preview', quiz: 'q-http', score: 41, date_taken: '2026-03-11T10:00:00Z', result_status: 'FAILED' },
    { external_id: 'r-2', user_id: 'u-preview', username: 'preview', quiz: 'q-http', score: 62, date_taken: '2026-03-18T10:00:00Z', result_status: 'FAILED' },
    { external_id: 'r-3', user_id: 'u-preview', username: 'preview', quiz: 'q-http', score: 88, date_taken: '2026-03-25T10:00:00Z', result_status: 'PASSED' },
    { external_id: 'r-4', user_id: 'u-preview', username: 'preview', quiz: 'q-tpl', score: 100, date_taken: '2026-04-02T10:00:00Z', result_status: 'PASSED' },
    { external_id: 'r-5', user_id: 'u-preview', username: 'preview', quiz: 'q-vlan', score: 74, result_status: 'PASSED' },
    { external_id: 'r-6', user_id: 'u-preview', username: 'preview', quiz: 'q-subnet', score: 55, date_taken: '2026-07-30T10:00:00Z', result_status: 'FAILED' },
    // Enough rows to overflow the Quiz Results card's scroll cap.
    { external_id: 'r-7', user_id: 'u-preview', username: 'preview', quiz: 'q-dock', score: 92, date_taken: '2026-09-08T10:00:00Z', result_status: 'PASSED' },
    { external_id: 'r-8', user_id: 'u-preview', username: 'preview', quiz: 'q-py', score: 81, date_taken: '2026-09-24T10:00:00Z', result_status: 'PASSED' },
    { external_id: 'r-9', user_id: 'u-preview', username: 'preview', quiz: 'q-py2', score: 67, date_taken: '2026-09-29T10:00:00Z', result_status: 'FAILED' },
];

const QUIZZES: Record<string, Quiz> = {
    'q-http': { external_id: 'q-http', title: 'HTTP methods and status codes', course_id: 'course-web', lesson_id: 'l-web-1', quiz_duration: 15, description: '' },
    'q-tpl': { external_id: 'q-tpl', title: 'Template inheritance', course_id: 'course-web', lesson_id: 'l-web-2', quiz_duration: 10, description: '' },
    'q-vlan': { external_id: 'q-vlan', title: 'VLANs and trunking', course_id: 'course-net', lesson_id: 'l-net-1', quiz_duration: 20, description: '' },
    // No course at all, so the totals count it and no course row does.
    'q-dock': { external_id: 'q-dock', title: 'Images, layers and the build cache', course_id: 'course-docker', lesson_id: 'l-dock-1', quiz_duration: 15, description: '' },
    'q-py': { external_id: 'q-py', title: 'Functions and scope', course_id: 'course-py', lesson_id: 'l-py-1', quiz_duration: 15, description: '' },
    'q-py2': { external_id: 'q-py2', title: 'Recursion', course_id: 'course-py', lesson_id: 'l-py-1', quiz_duration: 15, description: '' },
    'q-subnet': { external_id: 'q-subnet', title: 'Subnetting', course_id: '', lesson_id: '', quiz_duration: 20, description: '' },
};

const delay = <T,>(v: T, ms = 110): Promise<T> => new Promise(r => setTimeout(() => r(v), ms));

export const quizService = {
    getUserQuizResults: (_userId: string) => delay(EMPTY ? [] : RESULTS),
    getQuiz: (id: string) => QUIZZES[id]
        ? delay(QUIZZES[id], 40)
        : Promise.reject(new Error(`preview: no quiz ${id}`)),
};
