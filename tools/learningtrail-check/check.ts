// Verifies src/utils/learningTrail.ts - the way back to a lesson from its
// quiz, lab, runbook and result - without a browser and without a network.
//
//   npm run check:learningtrail
//
// What fails silently without this check:
//
//   * A TRAIL WITH NO LESSON IN IT. Half an origin (a lesson id with no course)
//     cannot become an address, and a row that starts at "Course" reads as the
//     lesson having been lost. Nothing is returned rather than that.
//   * A PAGE OFFERING ITSELF. A quiz page with "Take Quiz", a lab with
//     "Practise in the lab": a link to where you already are reads as broken.
//   * A LINK THE GUARD BOUNCES. `/lab/:id` needs lab_feature and `/runbooks/:id`
//     runbook_feature; drawn without them, the click goes nowhere.
//   * A LAB LINK THAT FORGETS ITS LESSON. Every lesson-side lab link has to carry
//     `?course=&lesson=`, or the lab page has no way back.
//   * A REMEMBERED ORIGIN BEING OVERWRITTEN by a page that merely displayed the
//     lab, when the student actually came from a different lesson.
//   * A CORRUPT localStorage VALUE taking the lab page down.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    ORIGIN_CAP, ORIGIN_KEY, labPath, lessonPath, nextLessonOf, originFromQuery,
    quizPath, recallOrigin, rememberOrigins, trailLinks, type OriginStore, type TrailInput,
} from '../../src/utils/learningTrail';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}

function memoryStore(initial: Record<string, string> = {}): OriginStore & { data: Map<string, string> } {
    const data = new Map(Object.entries(initial));
    return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
}

const base: TrailInput = {
    here: 'quiz', courseId: 'c-1', lessonId: 'l-3',
    lessonTitle: 'HTTP headers', courseTitle: 'Web Technologies',
    labId: 'web-02', runbookId: 17, quizId: 'q-9',
    next: { id: 'l-4', title: 'Cookies' },
    access: { lab: true, runbook: true },
};
const kinds = (input: TrailInput) => trailLinks(input).map(l => l.kind);

console.log('\ntrailLinks');
check('quiz page: lesson first, never itself',
    JSON.stringify(kinds(base)) === JSON.stringify(['lesson', 'course', 'lab', 'runbook', 'next']), kinds(base));
check('lab page drops the lab', !kinds({ ...base, here: 'lab' }).includes('lab'));
check('runbook page drops the runbook', !kinds({ ...base, here: 'runbook' }).includes('runbook'));
check('review page KEEPS the quiz (a retake is a real action)', kinds({ ...base, here: 'review' }).includes('quiz'));
check('no lesson id: nothing at all', trailLinks({ ...base, lessonId: '' }).length === 0);
check('no course id: nothing at all', trailLinks({ ...base, courseId: '  ' }).length === 0);
check('no lab access: no lab link', !kinds({ ...base, access: { lab: false, runbook: true } }).includes('lab'));
check('no runbook access: no runbook link', !kinds({ ...base, access: { lab: true, runbook: false } }).includes('runbook'));
check('a lesson with no lab draws none', !kinds({ ...base, labId: '' }).includes('lab'));
check('runbook id 0 is not "no runbook"', kinds({ ...base, here: 'review', runbookId: 0 }).includes('runbook'));
check('runbook id null is none', !kinds({ ...base, runbookId: null }).includes('runbook'));
check('the next lesson is never this lesson', !kinds({ ...base, next: { id: 'l-3' } }).includes('next'));

const links = trailLinks({ ...base, here: 'review' });
const byKind = Object.fromEntries(links.map(l => [l.kind, l]));
check('lesson link is the lesson route', byKind.lesson.to.path === '/course/c-1/lesson/l-3', byKind.lesson.to);
check('lesson label is the title, untranslated', byKind.lesson.label === 'HTTP headers' && !byKind.lesson.translate);
check('lab link carries its lesson',
    JSON.stringify(byKind.lab.to.query) === JSON.stringify({ course: 'c-1', lesson: 'l-3' }), byKind.lab.to);
check('quiz link uses the three query names TakeQuiz reads',
    JSON.stringify(byKind.quiz.to.query) === JSON.stringify({ quizId: 'q-9', lessonId: 'l-3', courseId: 'c-1' }));
check('runbook link is the runbook route', byKind.runbook.to.path === '/runbooks/17');
const untitled = trailLinks({ ...base, lessonTitle: '', courseTitle: '', next: { id: 'l-4' } });
check('no title yet: a translatable fallback, never an empty button',
    untitled.filter(l => ['lesson', 'course', 'next'].includes(l.kind)).every(l => l.translate && l.label.length > 0), untitled);
check('ids are encoded into one segment', lessonPath('a/b', 'c d').path === '/course/a%2Fb/lesson/c%20d');

console.log('\nlabPath / originFromQuery');
check('labPath without a lesson is a plain link', labPath('x').query === undefined);
check('labPath with half an origin is a plain link', labPath('x', 'c', '').query === undefined);
check('origin needs both', originFromQuery({ course: 'c' }) === null);
check('origin reads both',
    JSON.stringify(originFromQuery({ course: 'c', lesson: 'l' })) === JSON.stringify({ courseId: 'c', lessonId: 'l' }));
check('origin takes the first of a repeated param', originFromQuery({ course: ['c', 'z'], lesson: 'l' })?.courseId === 'c');
check('quizPath matches the route', quizPath('q', 'c', 'l').path === '/take-quiz');

console.log('\nnextLessonOf');
const syllabus = [{ external_lesson_id: 'a' }, { external_lesson_id: 'b' }, { external_lesson_id: 'c' }];
check('the one after', nextLessonOf(syllabus, 'a')?.external_lesson_id === 'b');
check('none after the last', nextLessonOf(syllabus, 'c') === null);
check('a lesson not in the list is null, not the first', nextLessonOf(syllabus, 'zz') === null);

console.log('\nremember / recall');
{
    const store = memoryStore();
    rememberOrigins(store, [{ labId: 'lab1', courseId: 'c1', lessonId: 'l1' }], 1000);
    check('a passive sighting fills a gap', recallOrigin(store, 'lab1')?.lessonId === 'l1');
    rememberOrigins(store, [{ labId: 'lab1', courseId: 'c2', lessonId: 'l9' }], 2000);
    check('a second passive sighting does not displace the first', recallOrigin(store, 'lab1')?.lessonId === 'l1');
    rememberOrigins(store, [{ labId: 'lab1', courseId: 'c2', lessonId: 'l9' }], 3000, true);
    check('an explicit origin (the click) wins', recallOrigin(store, 'lab1')?.lessonId === 'l9');
    rememberOrigins(store, [{ labId: 'lab1', courseId: 'c1', lessonId: 'l1' }], 4000);
    check('and a passive sighting does not undo it', recallOrigin(store, 'lab1')?.lessonId === 'l9');
    rememberOrigins(store, [{ labId: '', courseId: 'c', lessonId: 'l' }, { labId: 'x', courseId: '', lessonId: 'l' }], 5000);
    check('rows with no lab or no course are ignored',
        !recallOrigin(store, 'x') && Object.keys(JSON.parse(store.data.get(ORIGIN_KEY)!)).length === 1);
    check('unknown lab recalls nothing', recallOrigin(store, 'nope') === null);
}
{
    const corrupt = memoryStore({ [ORIGIN_KEY]: '{not json' });
    check('corrupt storage reads as nothing', recallOrigin(corrupt, 'lab1') === null);
    rememberOrigins(corrupt, [{ labId: 'lab1', courseId: 'c', lessonId: 'l' }], 1);
    check('and is replaced by a valid map', recallOrigin(corrupt, 'lab1')?.lessonId === 'l');
    const arrayed = memoryStore({ [ORIGIN_KEY]: '[1,2]' });
    check('an array is not a map', recallOrigin(arrayed, '0') === null);
    check('null store is harmless', recallOrigin(null, 'x') === null);
    rememberOrigins(null, [{ labId: 'a', courseId: 'b', lessonId: 'c' }], 1);
}
{
    const store = memoryStore();
    const rows = Array.from({ length: ORIGIN_CAP + 20 }, (_, i) => ({ labId: `lab${i}`, courseId: 'c', lessonId: `l${i}` }));
    rows.forEach((row, i) => rememberOrigins(store, [row], i + 10, true));
    const kept = Object.keys(JSON.parse(store.data.get(ORIGIN_KEY)!));
    check(`capped at ${ORIGIN_CAP}`, kept.length === ORIGIN_CAP, kept.length);
    check('the oldest go first', !kept.includes('lab0') && kept.includes(`lab${ORIGIN_CAP + 19}`));
}

console.log('\nthe pages use it');
// Relative to the repo root, as every other check here reads source: npm runs
// scripts from there, and `new URL(..., import.meta.url)` is rewritten by vite.
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');
for (const view of ['views/LessonDetails.vue', 'views/CourseDetails.vue']) {
    const src = read(view);
    check(`${view}: lab links go through labPath`, src.includes('labPath(') && !src.includes(':to="`/lab/${'));
    check(`${view}: remembers which lessons link which labs`, src.includes('rememberOrigins('));
}
const pages: Array<[string, string]> = [
    ['views/TakeQuiz.vue', 'quiz'], ['views/ReviewResults.vue', 'review'],
    ['views/RunbookDetails.vue', 'runbook'], ['views/LabWorkspace.vue', 'lab'],
];
for (const [view, here] of pages) {
    check(`${view} draws the trail as here="${here}"`, read(view).includes(`here="${here}"`));
}
const quizSrc = read('views/TakeQuiz.vue');
check('TakeQuiz falls back to the quiz record\'s own ids',
    quizSrc.includes('quiz.value?.course_id') && quizSrc.includes('quiz.value?.lesson_id'));
check('TakeQuiz: the void card, the result card and the start screen all offer the lesson',
    (quizSrc.match(/@click="returnToLesson"/g) || []).length >= 3);
const trailSrc = read('components/LessonTrail.vue');
check('the trail never uses v-html', !trailSrc.includes('v-html'));
check('the trail settles, never awaits all-or-nothing', trailSrc.includes('Promise.allSettled'));

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
