// src/utils/lessonOrder.ts
//
// Which order a course's lessons go in. A plain module — no Vue, no DOM — the
// same precedent as lessonContent.ts, photoMask.ts, drawEngine.ts, appNav.ts,
// examShuffle.ts, proctorQueue.ts and leaderboardEngine.ts, so
// `npm run check:lessonorder` can drive it in node in about a second.
//
// WHY THIS EXISTS
// ---------------
// App 19 answers `/lessons/?course_id=` in whatever order its store holds the
// records, which is insertion order over a uid-keyed map — arbitrary, and
// stable enough that nobody notices it is arbitrary. Neither the course page
// nor the lesson page sorted, so both rendered that order directly. Measured
// against the live catalogue on 2026-08-27:
//
//   Big Data Fundamentals    Module 31 first, Module 1 last   (31 lessons, reversed)
//   Kivy                     Part 16 first, Part 1 last       (16 lessons, reversed)
//   Django e-commerce        "Shipping Address and Coupon" first, "introduction" last
//   Software Engineering     Lecture 10 between 8 and 9
//
// Seventeen of the twenty-five courses were affected. It is worse than untidy on
// the LESSON page, because `previousLesson` / `nextLesson` and the "3 of 16"
// counter are all index arithmetic over that same list: a reader pressing Next
// on a reversed course walks BACKWARDS through the syllabus, and the counter
// tells them lesson 1 is lesson 31.
//
// THE SIGNAL IS THE TITLE, AND IT IS EXPLICIT
// -------------------------------------------
// Twenty of the twenty-five courses number their lessons in the title —
// `Module 3: …`, `Lecture 12 …`, `Python Kivy Game Part 7`. That is an
// operator's own statement of the order, so it is what we sort on. It is also
// why a plain `localeCompare` on the title is NOT the answer: it puts
// `Module 10` before `Module 2`, which is the same natural-sort bug one step
// further along.
//
// THE FIVE COURSES WITH NO NUMBERS, AND WHY REVERSED DATES ARE NOT A GUESS
// ------------------------------------------------------------------------
// AWS Training, Django e-commerce, Full Stack IONIC and Flask, Python Basics and
// Python OS Module number nothing. All five were bulk-imported: every lesson in
// each carries a `date_added` inside the same one-second window. And every one
// of the SEVENTEEN numbered courses imported in that same way has its numbering
// in DESCENDING date order — the importer inserted each course last lesson
// first, without exception. So for a bulk-imported batch, reversing the dates
// recovers the source order, and that is measured from the courses where the
// answer is independently known rather than inferred from the ones where it is
// not. It reads correctly too: Django e-commerce comes out
// "introduction" → "Setup Django Enviroment" → … → "Shipping Address and Coupon".
//
// The reversal is applied per BATCH rather than per course, which is what stops
// it decaying. A lesson added by hand next year is its own batch and lands in
// chronological position at the end, instead of flipping to the front and
// silently reordering the whole course.
//
// THE DURABLE FIX IS A FIELD, AND THIS IS NOT IT
// -----------------------------------------------
// All of the above infers an order that an operator should simply be able to
// state. App 19's lesson record has no position field, so there is nowhere to
// put it; adding one (and a reorder control in selfstudyadmin, on the model of
// app 17's `update_section_positions`) would make every rule here a fallback
// for records written before it existed. `explicitOrder` below already prefers
// such a field if one ever appears, so the day it does, this module needs no
// change to start honouring it.

/** The shape this module needs. Every real lesson record is compatible. */
export interface OrderableLesson {
    external_lesson_id?: string;
    title?: string;
    date_added?: string;
    /** Not on app 19 today. Honoured first if it is ever added. */
    order?: number | string | null;
    position?: number | string | null;
}

/**
 * Words an operator numbers a lesson with, in the live catalogue and a few
 * obvious neighbours. Anchoring on a keyword is what keeps the match honest:
 * a bare scan for digits reads `Lecture 5 HTML and CSS Fundamentals (2)` as 2,
 * and `AWS Route 53` as 53.
 */
const SEQUENCE_WORDS = [
    'module', 'lecture', 'lesson', 'part', 'chapter', 'unit', 'week', 'day',
    'session', 'step',
];

const KEYWORD = new RegExp(
    String.raw`(?:^|[^\p{L}])(?:${SEQUENCE_WORDS.join('|')})\s*[:.\-–—]?\s*(\d{1,3})(?![\d])`,
    'iu',
);

/** `3.` / `03 -` / `3)` at the very start, for a course that numbers without a word. */
const LEADING = /^\s*(\d{1,3})\s*[.):\-–—]\s+\S/;

/** Records landing inside this window of each other are one import batch. */
export const BATCH_WINDOW_MS = 60_000;
/** Below this a batch is somebody adding a couple of lessons, not an import. */
export const BATCH_MIN_SIZE = 3;

/**
 * The sequence number an operator wrote into the title, or `null`.
 *
 * Deliberately NOT a general "first number in the string": `AWS Route 53` and
 * `Lecture 5 … (2)` both have digits and only one of them has an order.
 */
export function sequenceNumber(title?: string | null): number | null {
    const text = (title || '').trim();
    if (!text) return null;
    const keyed = KEYWORD.exec(text);
    if (keyed) return Number(keyed[1]);
    const leading = LEADING.exec(text);
    if (leading) return Number(leading[1]);
    return null;
}

/** A position an operator set explicitly, if the record ever carries one. */
export function explicitOrder(lesson: OrderableLesson): number | null {
    for (const value of [lesson.order, lesson.position]) {
        if (value === null || value === undefined || value === '') continue;
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function addedAt(lesson: OrderableLesson): number | null {
    const raw = lesson.date_added;
    if (!raw) return null;
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Group by `date_added` into import batches, reverse the bulk ones, and
 * concatenate chronologically. Records with no usable date keep their input
 * order and go last — an undated record is not evidence of anything, and
 * putting it first would let one bad row reorder a whole course.
 */
function byImportBatch<T extends OrderableLesson>(lessons: readonly T[]): T[] {
    const dated: Array<{ row: T; at: number; index: number }> = [];
    const undated: T[] = [];
    lessons.forEach((row, index) => {
        const at = addedAt(row);
        if (at === null) undated.push(row);
        else dated.push({ row, at, index });
    });

    // Stable: equal timestamps keep the order the service sent them in.
    dated.sort((a, b) => (a.at - b.at) || (a.index - b.index));

    const out: T[] = [];
    let batch: Array<{ row: T; at: number; index: number }> = [];
    const flush = () => {
        if (!batch.length) return;
        // A bulk import went in last-lesson-first on every course where the
        // numbering lets us check. Two or three records is somebody adding
        // lessons by hand, and those are already chronological.
        out.push(...(batch.length >= BATCH_MIN_SIZE
            ? batch.slice().reverse()
            : batch).map(entry => entry.row));
        batch = [];
    };
    for (const entry of dated) {
        if (batch.length && entry.at - batch[batch.length - 1].at > BATCH_WINDOW_MS) flush();
        batch.push(entry);
    }
    flush();
    return [...out, ...undated];
}

/**
 * Give every lesson a sort key: its own number, or one INTERPOLATED from the
 * numbered lessons either side of it in the source order.
 *
 * A course is rarely numbered all the way through, and where it is not, the
 * unnumbered lesson is not always at the end. Both live cases are real and they
 * point opposite ways:
 *
 *   Kivy      `Python Simple Game Using Kivy` sits immediately BEFORE
 *             `Part 2` in the source order, and the course has no Part 1 --
 *             so it is the introduction, and putting it last starts the
 *             course on lesson two.
 *   ES6       `Building a Small ES6 Project` sits AFTER `Module 9`, so it is
 *             the closing project and last is exactly right.
 *
 * Sending both to the end gets one of them wrong, and the source order already
 * knows which. So an unnumbered lesson is placed between its numbered
 * neighbours, and several in a row keep their relative order by dividing the
 * gap between them.
 */
function withInterpolatedKeys<T extends OrderableLesson>(
    rows: readonly T[],
): Array<{ row: T; key: number; sourceIndex: number }> {
    const source = byImportBatch(rows);
    const numbers = source.map(row => sequenceNumber(row.title));

    const keys = new Array<number>(source.length);
    for (let i = 0; i < source.length; i++) {
        const own = numbers[i];
        if (own !== null && own !== undefined) { keys[i] = own; continue; }

        // The run of unnumbered lessons this one belongs to.
        let start = i;
        while (start > 0 && numbers[start - 1] === null) start--;
        let end = i;
        while (end + 1 < source.length && numbers[end + 1] === null) end++;

        const before = start > 0 ? numbers[start - 1]! : null;
        const after = end + 1 < source.length ? numbers[end + 1]! : null;
        const run = end - start + 1;
        const step = (i - start + 1) / (run + 1);   // 0 < step < 1, in order

        if (before !== null && after !== null && after > before) {
            keys[i] = before + (after - before) * step;
        } else if (before !== null) {
            keys[i] = before + step;                // trailing: a closing project
        } else if (after !== null) {
            keys[i] = after - 1 + step;             // leading: an introduction
        } else {
            keys[i] = i;                            // no numbers anywhere near
        }
    }
    return source.map((row, index) => ({ row, key: keys[index], sourceIndex: index }));
}

/**
 * A course's lessons, first to last.
 *
 * Never mutates the input — the caller's array is the service's cached list on
 * two different pages, and sorting in place is how one page reorders another's
 * data. Same reason `sortScene` copies in drawEngine.ts.
 */
export function orderLessons<T extends OrderableLesson>(lessons: readonly T[]): T[] {
    const rows = [...(lessons || [])];
    if (rows.length < 2) return rows;

    // 1. An explicit position beats everything, if the record ever gains one.
    if (rows.some(row => explicitOrder(row) !== null)) {
        return rows
            .map((row, index) => ({ row, index, key: explicitOrder(row) }))
            .sort((a, b) => {
                if (a.key === null && b.key === null) return a.index - b.index;
                if (a.key === null) return 1;
                if (b.key === null) return -1;
                return (a.key - b.key) || (a.index - b.index);
            })
            .map(entry => entry.row);
    }

    // 2. The number the operator wrote in the title.
    if (rows.some(row => sequenceNumber(row.title) !== null)) {
        const keyed = withInterpolatedKeys(rows);
        return keyed
            .slice()
            .sort((a, b) => (a.key - b.key) || (a.sourceIndex - b.sourceIndex))
            .map(entry => entry.row);
    }

    // 3. Nothing is numbered: recover the import order.
    return byImportBatch(rows);
}

/** 1-based position of a lesson in its ordered course, or 0 when absent. */
export function positionOf(
    lessons: readonly OrderableLesson[], lessonId?: string | null,
): number {
    if (!lessonId) return 0;
    const index = lessons.findIndex(row => row.external_lesson_id === lessonId);
    return index < 0 ? 0 : index + 1;
}
