/**
 * THE WAY BACK TO THE LESSON, from a quiz, a lab, a runbook or a result.
 *
 * A lesson is the hub of this platform: it links OUT to a quiz, a lab and a
 * runbook, and until this module nothing linked back IN. A student who finished
 * a quiz was offered "Return to Course" - twenty lessons up the tree from the
 * one they were reading - and a lab and a runbook offered only their own
 * catalogues. This decides, for any of those pages, where "back" goes and what
 * else belongs beside it. A plain module, on the `lessonOrder.ts` /
 * `appNav.ts` precedent, so `npm run check:learningtrail` can drive it in node.
 *
 * WHERE THE LESSON COMES FROM is different for each kind, and that difference
 * is the whole reason this is a module rather than three inline links:
 *
 *  - a QUIZ and a RUNBOOK carry `course_id` and `lesson_id` on their own record,
 *    so their lesson is a fact;
 *  - a LAB does not. App 11 has no idea which lessons link to it, and up to ten
 *    do (246 lesson links over a few dozen labs), so the lesson has to arrive
 *    with the click - `/lab/:id?course=…&lesson=…` - or be remembered from the
 *    last time a lesson or a course page showed a link to it. Both are below.
 *
 * No `user_id` and nothing personal goes into storage here: a lab id and a pair
 * of public catalogue ids, on a page that already shows all three.
 */

import type { LocationQueryRaw } from 'vue-router';

export type TrailKind = 'lesson' | 'course' | 'lab' | 'runbook' | 'quiz' | 'next';

/** The page the trail is drawn on, which is never offered as a destination. */
export type TrailHere = 'quiz' | 'lab' | 'runbook' | 'review';

export interface TrailTarget {
    path: string;
    query?: LocationQueryRaw;
}

export interface TrailLink {
    kind: TrailKind;
    to: TrailTarget;
    /** A display string the component passes through `$t`, or a record title. */
    label: string;
    /** True when `label` is an English catalogue key rather than data. */
    translate: boolean;
}

export interface TrailInput {
    here: TrailHere;
    courseId: string;
    lessonId: string;
    lessonTitle?: string;
    courseTitle?: string;
    labId?: string;
    runbookId?: number | string | null;
    quizId?: string;
    next?: { id: string; title?: string } | null;
    /** What the signed-in user may open - a link the guard bounces reads as broken. */
    access: { lab: boolean; runbook: boolean };
}

const clean = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : (value == null ? '' : String(value).trim());

export const lessonPath = (courseId: string, lessonId: string): TrailTarget =>
    ({ path: `/course/${encodeURIComponent(courseId)}/lesson/${encodeURIComponent(lessonId)}` });

export const coursePath = (courseId: string): TrailTarget =>
    ({ path: `/course/${encodeURIComponent(courseId)}` });

/**
 * A lab link that remembers which lesson it came from.
 *
 * The query is what lets the lab page draw "Back to the lesson" at all, so
 * every lesson-side link to a lab goes through here. Without both ids it is a
 * plain lab link - half an origin is worse than none, because a lesson id with
 * no course cannot be turned into an address.
 */
export function labPath(labId: string, courseId?: string, lessonId?: string): TrailTarget {
    const path = `/lab/${encodeURIComponent(labId)}`;
    const course = clean(courseId);
    const lesson = clean(lessonId);
    return course && lesson ? { path, query: { course, lesson } } : { path };
}

/** The quiz route reads these three query names; keep them in one place. */
export const quizPath = (quizId: string, courseId: string, lessonId: string): TrailTarget =>
    ({ path: '/take-quiz', query: { quizId, lessonId, courseId } });

export const runbookPath = (id: number | string): TrailTarget =>
    ({ path: `/runbooks/${encodeURIComponent(String(id))}` });

/**
 * Every link the trail shows, in reading order: the lesson first (it is the
 * point), then the course, then the lesson's other activities, then onward.
 *
 * Nothing is offered that the page itself is, nothing the user cannot open,
 * and nothing is returned at all without BOTH ids - a trail that cannot say
 * where the lesson is has no first link, and a row that starts with "Course"
 * reads as the lesson having been lost.
 */
export function trailLinks(input: TrailInput): TrailLink[] {
    const courseId = clean(input.courseId);
    const lessonId = clean(input.lessonId);
    if (!courseId || !lessonId) return [];

    const out: TrailLink[] = [];
    const lessonTitle = clean(input.lessonTitle);
    out.push({
        kind: 'lesson', to: lessonPath(courseId, lessonId),
        // The title when we have it, so the student can see WHICH lesson; a
        // generic key while it is loading or when app 19 did not answer.
        label: lessonTitle || 'Back to the lesson', translate: !lessonTitle,
    });

    const courseTitle = clean(input.courseTitle);
    out.push({
        kind: 'course', to: coursePath(courseId),
        label: courseTitle || 'Back to Course', translate: !courseTitle,
    });

    const labId = clean(input.labId);
    if (input.here !== 'lab' && labId && input.access.lab) {
        out.push({ kind: 'lab', to: labPath(labId, courseId, lessonId),
                   label: 'Practise in the lab', translate: true });
    }

    const runbookId = clean(input.runbookId);
    if (input.here !== 'runbook' && runbookId && input.access.runbook) {
        out.push({ kind: 'runbook', to: runbookPath(runbookId), label: 'Runbook', translate: true });
    }

    // A review is OF a quiz, but it is not the quiz: "take it again" from the
    // review screen is a real action, so only the quiz page itself drops it.
    const quizId = clean(input.quizId);
    if (input.here !== 'quiz' && quizId) {
        out.push({ kind: 'quiz', to: quizPath(quizId, courseId, lessonId),
                   label: 'Take Quiz', translate: true });
    }

    const nextId = clean(input.next?.id);
    if (nextId && nextId !== lessonId) {
        const title = clean(input.next?.title);
        out.push({ kind: 'next', to: lessonPath(courseId, nextId),
                   label: title || 'Next lesson', translate: !title });
    }
    return out;
}

/**
 * The lesson after this one, from a list ALREADY in syllabus order
 * (`courseService.getCourseLessons` sorts it). Null for the last lesson, and
 * null for a lesson that is not in the list - guessing "the first one" there
 * would send somebody back to the start of the course.
 */
export function nextLessonOf<T extends { external_lesson_id: string }>(ordered: T[], lessonId: string): T | null {
    const index = ordered.findIndex(row => row.external_lesson_id === lessonId);
    return index >= 0 ? ordered[index + 1] ?? null : null;
}

// ---------------------------------------------------------------------------
// The lab's origin
// ---------------------------------------------------------------------------

export interface LessonRef {
    courseId: string;
    lessonId: string;
}

interface StoredOrigin extends LessonRef {
    at: number;
}

/** Enough for every lab a student touches in a term, small enough to never matter. */
export const ORIGIN_CAP = 80;
export const ORIGIN_KEY = 'sfs-lab-origin';

/** Read `?course=&lesson=` off a lab route. Both or nothing. */
export function originFromQuery(query: Record<string, unknown>): LessonRef | null {
    const pick = (v: unknown) => clean(Array.isArray(v) ? v[0] : v);
    const courseId = pick(query.course);
    const lessonId = pick(query.lesson);
    return courseId && lessonId ? { courseId, lessonId } : null;
}

/** The minimal Storage surface, so the check can pass a Map-backed stand-in. */
export interface OriginStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

function readAll(store: OriginStore | null): Record<string, StoredOrigin> {
    if (!store) return {};
    try {
        const parsed = JSON.parse(store.getItem(ORIGIN_KEY) || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        // localStorage is writable by anything on the origin; a corrupt value
        // is "nothing remembered", never a page that fails to render.
        return {};
    }
}

function writeAll(store: OriginStore | null, all: Record<string, StoredOrigin>): void {
    if (!store) return;
    const kept = Object.entries(all)
        .sort((a, b) => (b[1].at - a[1].at) || a[0].localeCompare(b[0]))
        .slice(0, ORIGIN_CAP);
    try { store.setItem(ORIGIN_KEY, JSON.stringify(Object.fromEntries(kept))); } catch { /* quota, private mode */ }
}

/**
 * Remember lab → lesson for every lesson that links a lab. Called by the course
 * page and the lesson page, which already have the lessons in hand, so a lab
 * opened later from the catalogue still knows a lesson it belongs to.
 *
 * `explicit` is a lab opened FROM a lesson, which outranks anything a page
 * merely displayed: when several lessons share a lab, the one the student
 * actually came from is the one "back" should mean.
 */
export function rememberOrigins(
    store: OriginStore | null,
    rows: Array<{ labId: string; courseId: string; lessonId: string }>,
    now: number,
    explicit = false,
): void {
    const valid = rows
        .map(r => ({ labId: clean(r.labId), courseId: clean(r.courseId), lessonId: clean(r.lessonId) }))
        .filter(r => r.labId && r.courseId && r.lessonId);
    if (!valid.length) return;
    const all = readAll(store);
    for (const row of valid) {
        const prior = all[row.labId];
        // A passive sighting never displaces an explicit origin; it only fills
        // a gap or refreshes the same pair. Its timestamp is a hair OLDER than
        // `now` so an explicit write in the same millisecond still wins.
        if (!explicit && prior && (prior.courseId !== row.courseId || prior.lessonId !== row.lessonId)) continue;
        all[row.labId] = { courseId: row.courseId, lessonId: row.lessonId, at: explicit ? now : now - 1 };
    }
    writeAll(store, all);
}

export function recallOrigin(store: OriginStore | null, labId: string): LessonRef | null {
    const hit = readAll(store)[clean(labId)];
    if (!hit || !clean(hit.courseId) || !clean(hit.lessonId)) return null;
    return { courseId: clean(hit.courseId), lessonId: clean(hit.lessonId) };
}

/** `window.localStorage`, or null where there is none (node, a locked-down browser). */
export function browserStore(): OriginStore | null {
    try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
