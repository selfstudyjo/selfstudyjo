// Verifies src/utils/lessonOrder.ts against the shapes the live catalogue
// actually contains, without a browser and without a network.
//
//   npm run check:lessonorder
//
// The fixtures below are REAL title sets read off app 19 on 2026-08-27, not
// invented ones, because every interesting case here is a real course:
// `Module 10` sorting before `Module 2`, `AWS Route 53` having a number that is
// not an order, a bulk import inserted backwards, and one unnumbered project
// among nine numbered modules.
//
// What fails silently without this check:
//
//   * A REVERSED COURSE. The list still renders, every lesson is present and
//     every link works. The only symptom is that lesson one is at the bottom.
//   * NEXT GOING BACKWARDS. The lesson page derives prev/next by index into
//     this order, so a reversed course makes Next walk up the syllabus and the
//     "3 of 16" counter count down.
//   * A NUMBER THAT IS NOT AN ORDER. `AWS Route 53` and `Lecture 5 … (2)` both
//     contain digits. A looser matcher reads 53 and 2 and scatters the course.
//   * A COURSE REORDERING ITSELF LATER. The bulk-import reversal is per batch
//     for this reason: a lesson added by hand next year must land at the end,
//     not flip the whole course.

import {
    BATCH_MIN_SIZE,
    orderLessons,
    positionOf,
    sequenceNumber,
    type OrderableLesson,
} from '../../src/utils/lessonOrder';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}

/** Build a course whose records arrive in the order given. */
function course(titles: string[], startMs = 0, stepMs = 25): OrderableLesson[] {
    return titles.map((title, index) => ({
        external_lesson_id: `id-${index}`,
        title,
        date_added: new Date(startMs + index * stepMs).toISOString(),
    }));
}
const titlesOf = (rows: OrderableLesson[]) => rows.map(r => r.title);

console.log('\n1. The number in the title, and the numbers that are not orders');
check('Module 3', sequenceNumber('Module 3: Working with Arrays and Lists') === 3);
check('Module 31', sequenceNumber('Module 31: Hive SQL Conditional Functions') === 31);
check('Lecture with a dash', sequenceNumber('Lecture 1 - Software Engineering Introduction (I)') === 1);
check('lower case keyword', sequenceNumber('lecture 4 HTML and CSS Fundamentals  (1)') === 4);
check('Part at the end', sequenceNumber('Python Kivy Game Part 16') === 16);
check('Lesson', sequenceNumber('Lesson 3 Revision') === 3);
check('a trailing (2) is not the order',
      sequenceNumber('Lecture 5 HTML and CSS Fundamentals  (2)') === 5);
check('a roman numeral is not a digit',
      sequenceNumber('Lecture 9 Software Architecture (I)') === 9);
check('AWS Route 53 has no order', sequenceNumber('AWS Route 53') === null);
check('a product number is not an order', sequenceNumber('Docker Compose v2') === null);
check('no digits at all', sequenceNumber('Shipping Address and Coupon') === null);
check('empty title', sequenceNumber('') === null && sequenceNumber(undefined) === null);
check('a bare leading number counts', sequenceNumber('3. Working with Files') === 3);
check('but a decimal price does not', sequenceNumber('19.90 JOD and other numbers') === null);
// `modulename` must not read as `module`, or one identifier reorders a course.
check('the keyword is a whole word', sequenceNumber('modulearity 7 patterns') === null);

console.log('\n2. Natural order, which is the whole reported bug');
const bigData = course([
    'Module 31: Hive SQL Conditional Functions', 'Module 30: Hive SQL Date Functions',
    'Module 3: Data Analysis', 'Module 2: Big Data Technologies',
    'Module 10: HDFS Copy And Remove Files', 'Module 1: Introduction to Big Data',
]);
check('Module 2 comes before Module 10',
      titlesOf(orderLessons(bigData)).join(' | ').indexOf('Module 2:')
      < titlesOf(orderLessons(bigData)).join(' | ').indexOf('Module 10:'));
check('a reversed course comes back forwards',
      titlesOf(orderLessons(bigData))[0]!.startsWith('Module 1:')
      && titlesOf(orderLessons(bigData))[5]!.startsWith('Module 31:'));
check('alphabetical would have got this wrong',
      [...titlesOf(bigData)].sort()[0] !== titlesOf(orderLessons(bigData))[0]);

const software = course([
    'Lecture 8 Requirement Engineering', 'Lecture 10 Software Architecture (II)',
    'Lecture 9 Software Architecture (I)',
]);
check('Lecture 10 entered before 9 is still placed after it',
      titlesOf(orderLessons(software)).map(t => sequenceNumber(t)).join(',') === '8,9,10');

console.log('\n3. An unnumbered lesson goes where the source order puts it');
// ES6 as it really is: the import went in backwards, so the project is LAST in
// source order -- after Module 9 -- and belongs at the end.
const es6 = course([
    'Building a Small ES6 Project - Restaurant and Recipe Website',
    'Module 2: Let and Const', 'Module 1: Introduction to ES6',
]);
check('a closing project stays last',
      titlesOf(orderLessons(es6))[2]!.startsWith('Building a Small'));
check('and the modules are in order',
      titlesOf(orderLessons(es6))[0]!.startsWith('Module 1'));

// Kivy as it really is: the course has no Part 1, and the unnumbered lesson
// sits immediately BEFORE Part 2 in source order. Sending every unnumbered
// lesson to the end would start this course on lesson two -- which is the bug
// the interpolation exists to prevent, and the reason "put them last" is wrong.
const kivy = course([
    'Python Kivy Game Part 4', 'Python Kivy Game Part 3',
    'Python Kivy Game Part 2', 'Python Simple Game Using Kivy',
]);
check('an introduction is placed FIRST, not last',
      titlesOf(orderLessons(kivy))[0] === 'Python Simple Game Using Kivy');
check('and the numbered parts still ascend behind it',
      titlesOf(orderLessons(kivy)).slice(1).map(t => sequenceNumber(t)).join(',') === '2,3,4');

// Two unnumbered in a row keep their own relative order rather than swapping.
// Hand-entered a day apart, so no batch reversal: chronological IS the source.
const web = course(['Lecture 1 Intro', 'Lecture 2 Introduction',
                    'Midterm Exam Questions', 'Final Exam'],
                   Date.parse('2026-01-01T00:00:00Z'), 86_400_000);
check('a run of unnumbered lessons keeps its own order',
      titlesOf(orderLessons(web)).slice(2).join('|')
      === 'Midterm Exam Questions|Final Exam');
check('and stays after the numbered lessons it followed',
      titlesOf(orderLessons(web))[0] === 'Lecture 1 Intro');

console.log('\n4. A bulk import with no numbers at all');
// Every lesson inside one second, inserted last-first -- the live shape of
// AWS Training, Django e-commerce, Full Stack IONIC, Python Basics and Python OS Module.
const ecommerce = course([
    'Shipping Address and Coupon', 'Messages and Cart Tag', 'Item Cart',
    'Completing Database Models', 'Sign In and Signup', 'introduction',
]);
check('a bulk batch is reversed back to source order',
      titlesOf(orderLessons(ecommerce))[0] === 'introduction'
      && titlesOf(orderLessons(ecommerce))[5] === 'Shipping Address and Coupon');

const pair = course(['Second thing', 'First thing'], 0, 30);
check(`fewer than ${BATCH_MIN_SIZE} records is not an import, so it is left chronological`,
      titlesOf(orderLessons(pair)).join('|') === 'Second thing|First thing');

console.log('\n5. A lesson added by hand later must not reorder the course');
const later: OrderableLesson[] = [
    ...course(['C', 'B', 'A']),                                    // the import, backwards
    { external_lesson_id: 'id-new', title: 'Added next year',
      date_added: new Date(400 * 24 * 3600 * 1000).toISOString() },
];
check('the import still reverses',
      titlesOf(orderLessons(later)).slice(0, 3).join('') === 'ABC');
check('and the late arrival lands at the end rather than the front',
      titlesOf(orderLessons(later))[3] === 'Added next year');

console.log('\n6. An explicit position wins, for the day app 19 grows one');
const withOrder: OrderableLesson[] = [
    { external_lesson_id: 'a', title: 'Module 9: nine', order: 2 },
    { external_lesson_id: 'b', title: 'Module 1: one', order: 1 },
];
check('the field beats the title', titlesOf(orderLessons(withOrder))[0] === 'Module 1: one');
const partial: OrderableLesson[] = [
    { external_lesson_id: 'a', title: 'No position' },
    { external_lesson_id: 'b', title: 'Has one', order: 5 },
];
check('a record with no position goes last rather than to zero',
      titlesOf(orderLessons(partial)).join('|') === 'Has one|No position');

console.log('\n7. Properties that hold for every input');
const samples = [bigData, software, es6, web, ecommerce, later, pair];
check('no lesson is ever lost or duplicated',
      samples.every(rows => {
          const out = orderLessons(rows);
          return out.length === rows.length
              && new Set(out.map(r => r.external_lesson_id)).size === rows.length;
      }));
check('the input array is never mutated',
      samples.every(rows => {
          const before = titlesOf(rows).join('|');
          orderLessons(rows);
          return titlesOf(rows).join('|') === before;
      }));
check('ordering is idempotent',
      samples.every(rows =>
          titlesOf(orderLessons(orderLessons(rows))).join('|')
          === titlesOf(orderLessons(rows)).join('|')));
check('empty and single-lesson courses are safe',
      orderLessons([]).length === 0 && orderLessons([{ title: 'only' }]).length === 1);
check('a course with no dates and no numbers keeps its arrival order',
      titlesOf(orderLessons([{ title: 'B' }, { title: 'A' }])).join('|') === 'B|A');

console.log('\n8. The counter and prev/next read the same order');
const ordered = orderLessons(bigData);
check('positionOf is 1-based against the ORDERED list',
      positionOf(ordered, ordered[0]!.external_lesson_id) === 1
      && positionOf(ordered, ordered[5]!.external_lesson_id) === 6);
check('an unknown id is 0 rather than a wrong position',
      positionOf(ordered, 'nope') === 0 && positionOf(ordered, undefined) === 0);
// The lesson page does `siblings[n-2]` and `siblings[n]`, so "next" must be the
// larger module number. This is the assertion that would have caught Next
// walking backwards through a reversed course.
const at = positionOf(ordered, ordered[2]!.external_lesson_id);
check('next is forwards through the syllabus',
      sequenceNumber(ordered[at]!.title)! > sequenceNumber(ordered[at - 1]!.title)!);
check('and previous is backwards',
      sequenceNumber(ordered[at - 2]!.title)! < sequenceNumber(ordered[at - 1]!.title)!);

console.log('\n9. Both pages go through the service, not their own sort');
// A view that sorted for itself would drift from the other one, and the lesson
// page's prev/next would disagree with the course page's list.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const service = read('src/services/course.service.ts');
check('getCourseLessons orders before returning', service.includes('orderLessons('));
for (const view of ['src/views/CourseDetails.vue', 'src/views/LessonDetails.vue']) {
    const body = read(view);
    check(`${view.split('/').pop()} does not sort lessons itself`,
          !/lessons\s*\.\s*sort\(|siblings\s*\.\s*sort\(/.test(body));
}

console.log(failures ? `\n${failures} check(s) FAILED\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
