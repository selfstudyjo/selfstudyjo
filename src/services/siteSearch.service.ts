/**
 * src/services/siteSearch.service.ts — what the top bar's search is allowed to fetch.
 *
 * Six catalogues from four services, each loaded on its own so one cold or dead
 * replica costs one section of results and nothing else. Every loader THROWS on
 * failure rather than answering an empty list: "this service has no runbooks"
 * and "this service did not answer" need different words on screen, and a
 * catalogue that is never legitimately empty (365 labs, 81 courses) reported as
 * empty would be a search that quietly finds nothing.
 *
 * ============================================================
 * WHAT IS FETCHED, AND WHAT DELIBERATELY IS NOT
 * ============================================================
 *
 *   courses       app 19  GET /courses/               (paged, every page)
 *   lessons       app 19  GET /lessons/               ONE request, see below
 *   labs          app 11  GET /api/labs/ + /tracks/ + /playgrounds/
 *   assessments   app 20  GET /assessment-titles/     titles only, NO answer key
 *   runbooks      app 17  GET /runbooks/
 *
 * **Never `/exams/` or `/quizzes/` on app 20.** Both nest every question with
 * every answer and its `is_correct`, the search box is on every page including
 * ones a signed-out visitor sees, and `/assessment-titles/` exists precisely so
 * a title can be shown without the paper (`check:sitesearch` reads this file
 * and fails on either path).
 *
 * **Lessons are one request, not one per course.** App 19 has no light list,
 * so the only way to every lesson title is the full lesson list -- ~12 MB of
 * JSON with the write-ups, ~3 MB gzipped on the wire. Per course it is the same
 * bytes in 81 round trips, each of which can be twenty seconds against a cold
 * replica. So it is fetched once, in the background, AFTER the cheap catalogues,
 * stripped to id + title + course in every language (~190 KB), and kept.
 *
 * ============================================================
 * CACHING
 * ============================================================
 *
 * In memory for the tab, and in localStorage for `STALE_AFTER`. localStorage
 * rather than sessionStorage because of the lesson list above: paying ~3 MB per
 * new tab to search titles is the wrong trade, and none of this is private --
 * every row is a public catalogue entry, identical for every reader, so nothing
 * about one account can leak to the next person at the keyboard. What the
 * reader may OPEN is decided later, from the auth store, and never cached.
 *
 * A stored copy is served at once and refreshed in the background when older
 * than `REFRESH_AFTER`, so the box answers instantly and a lesson published an
 * hour ago still turns up. A failure is never cached; the next open asks again.
 */

import { apiService, withReplicas } from './api';
import { courseService } from './course.service';
import { normalizePaginatedResponse } from '@/utils/api-utils';
import type {
    AssessmentRow, CourseRow, LabRow, LessonRow, PlaygroundRow, RunbookRow, TrackRow,
} from '@/utils/siteSearch';

const COURSE_APP_ID = parseInt(import.meta.env.VITE_COURSE_APP_ID || '19');
const LAB_APP_ID = parseInt(import.meta.env.VITE_LAB_APP_ID || '11');
const EXAM_APP_ID = parseInt(import.meta.env.VITE_EXAM_APP_ID || '20');
const RUNBOOK_APP_ID = parseInt(import.meta.env.VITE_RUNBOOK_APP_ID || '17');

export type SourceId = 'courses' | 'lessons' | 'labs' | 'assessments' | 'runbooks';

export interface LabsPayload { labs: LabRow[]; tracks: TrackRow[]; playgrounds: PlaygroundRow[] }
export interface AssessmentsPayload { exams: AssessmentRow[]; quizzes: AssessmentRow[] }

export interface SourcePayloads {
    courses: CourseRow[];
    lessons: LessonRow[];
    labs: LabsPayload;
    assessments: AssessmentsPayload;
    runbooks: RunbookRow[];
}

const STORAGE_PREFIX = 'sfs-gs:v1:';
/** A stored copy older than this is not used at all. */
export const STALE_AFTER = 24 * 3600 * 1000;
/** A stored copy older than this is used, and refreshed behind it. */
export const REFRESH_AFTER: Record<SourceId, number> = {
    courses: 30 * 60 * 1000,
    lessons: 3 * 3600 * 1000,
    labs: 60 * 60 * 1000,
    assessments: 60 * 60 * 1000,
    runbooks: 60 * 60 * 1000,
};

/* ------------------------------------------------------------------ *
 * Stripping: keep what the search reads, drop the rest before storing
 * ------------------------------------------------------------------ */

type Raw = Record<string, any>;

/** Cut long text: the search matches the start of a description, and storage is finite. */
const cut = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');

/** The translations map, reduced to the named fields, each cut to `max`. */
function slimTranslations(raw: unknown, names: readonly string[], max = 240) {
    const out: Record<string, Record<string, string>> = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [lang, entry] of Object.entries(raw as Raw)) {
        if (!entry || typeof entry !== 'object') continue;
        const kept: Record<string, string> = {};
        for (const name of names) {
            const text = cut((entry as Raw)[name], max);
            if (text.trim()) kept[name] = text;
        }
        if (Object.keys(kept).length) out[lang] = kept;
    }
    return out;
}

const str = (value: unknown) => (value == null ? '' : String(value));

export function slimCourse(c: Raw): CourseRow {
    return {
        // `external_course_id` is what `/course/:id` resolves; the numeric `id`
        // is the store's derived fold and routing on it 404s.
        id: str(c.external_course_id || c.id),
        title: str(c.title),
        description: cut(c.description, 240),
        translations: slimTranslations(c.translations, ['title', 'description']),
    };
}

export function slimLesson(l: Raw): LessonRow {
    return {
        id: str(l.external_lesson_id || l.id),
        title: str(l.title),
        course: str(l.course_external_id || l.course),
        translations: slimTranslations(l.translations, ['title'], 200),
    };
}

export function slimLab(l: Raw): LabRow {
    return {
        id: str(l.id),
        title: str(l.title),
        track: str(l.track),
        summary: cut(l.summary, 200),
        difficulty: str(l.difficulty),
        topics: Array.isArray(l.topics) ? l.topics.slice(0, 8).map(str) : [],
        translations: slimTranslations(l.translations, ['title', 'summary'], 200),
    };
}

export function slimTrack(t: Raw): TrackRow {
    return { id: str(t.id), title: str(t.title), translations: slimTranslations(t.translations, ['title']) };
}

export function slimPlayground(p: Raw): PlaygroundRow {
    return {
        id: str(p.id),
        title: str(p.title),
        summary: cut(p.summary, 160),
        tools: Array.isArray(p.tools)
            ? p.tools.slice(0, 8).map((tool: Raw) => str(tool?.label || tool?.id || tool)) : [],
        translations: slimTranslations(p.translations, ['title', 'summary'], 160),
    };
}

/** Title, course and lesson. Nothing else app 20 sends here is kept, or read. */
export function slimAssessment(a: Raw): AssessmentRow {
    return {
        id: str(a.external_id),
        title: str(a.title),
        course: str(a.course_id),
        lesson: str(a.lesson_id),
        translations: slimTranslations(a.translations, ['title']),
    };
}

/** A runbook arrives with every section's text; only the name is kept. */
export function slimRunbook(r: Raw): RunbookRow {
    return {
        id: str(r.id),
        title: str(r.title),
        course: str(r.course_id),
        lesson: str(r.lesson_id),
        translations: slimTranslations(r.translations, ['title']),
    };
}

const listOf = (payload: unknown): Raw[] => normalizePaginatedResponse<Raw>(payload).results;

/* ------------------------------------------------------------------ *
 * The loaders
 * ------------------------------------------------------------------ */

const LOADERS: { [K in SourceId]: () => Promise<SourcePayloads[K]> } = {
    async courses() {
        const rows = await courseService.getAllCourses();
        return rows.map(slimCourse).filter(c => c.id && c.title);
    },

    async lessons() {
        const payload = await withReplicas(COURSE_APP_ID, 'course',
            base => apiService.get<unknown>(base, '/lessons/'));
        return listOf(payload).map(slimLesson).filter(l => l.id && l.title && l.course);
    },

    async labs() {
        // `/api/labs/` answers `{count, labs, track, tracks}` - TWO lists - so
        // each key is named. A reader that took "the list" would get nothing.
        return withReplicas(LAB_APP_ID, 'lab', async base => {
            const [catalogue, tracks, playgrounds] = await Promise.all([
                apiService.get<{ labs?: Raw[] }>(base, '/api/labs/'),
                apiService.get<{ tracks?: Raw[] }>(base, '/api/labs/tracks/').catch(() => ({ tracks: [] })),
                apiService.get<{ playgrounds?: Raw[] }>(base, '/api/labs/playgrounds/')
                    .catch(() => ({ playgrounds: [] })),
            ]);
            const labs = (catalogue?.labs || []).map(slimLab).filter(l => l.id && l.title);
            if (!labs.length) throw new Error('The lab catalogue came back empty');
            return {
                labs,
                tracks: (tracks?.tracks || []).map(slimTrack).filter(t => t.id),
                playgrounds: (playgrounds?.playgrounds || []).map(slimPlayground).filter(p => p.id && p.title),
            };
        });
    },

    async assessments() {
        const payload = await withReplicas(EXAM_APP_ID, 'exam',
            base => apiService.get<{ exams?: Raw[]; quizzes?: Raw[] }>(base, '/assessment-titles/'));
        return {
            exams: (payload?.exams || []).map(slimAssessment).filter(a => a.id && a.title),
            quizzes: (payload?.quizzes || []).map(slimAssessment).filter(a => a.id && a.title),
        };
    },

    async runbooks() {
        const payload = await withReplicas(RUNBOOK_APP_ID, 'runbook',
            base => apiService.get<unknown>(base, '/runbooks/'));
        return listOf(payload).map(slimRunbook).filter(r => r.id && r.title);
    },
};

/* ------------------------------------------------------------------ *
 * The cache
 * ------------------------------------------------------------------ */

interface Stored<T> { at: number; rows: T }

function readStored<K extends SourceId>(id: K): Stored<SourcePayloads[K]> | null {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + id);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.at !== 'number' || parsed.rows == null) return null;
        if (Date.now() - parsed.at > STALE_AFTER || parsed.at > Date.now() + 60_000) return null;
        return parsed;
    } catch {
        return null; // a private window, a corrupt entry: ask the service
    }
}

function writeStored<K extends SourceId>(id: K, rows: SourcePayloads[K]): void {
    try {
        localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify({ at: Date.now(), rows }));
    } catch {
        // Quota: the in-memory copy serves this tab, and the next tab asks again.
        try { localStorage.removeItem(STORAGE_PREFIX + id); } catch { /* nothing to do */ }
    }
}

const memory = new Map<SourceId, Stored<unknown>>();
const inflight = new Map<SourceId, Promise<unknown>>();

/** A copy usable right now, from memory or storage, without a request. */
export function cached<K extends SourceId>(id: K): SourcePayloads[K] | null {
    const hit = (memory.get(id) as Stored<SourcePayloads[K]> | undefined) ?? readStored(id);
    if (!hit) return null;
    memory.set(id, hit);
    return hit.rows;
}

/** Is the copy we have old enough to refresh behind? */
export function wantsRefresh(id: SourceId): boolean {
    const hit = memory.get(id) ?? readStored(id);
    return !hit || Date.now() - hit.at > REFRESH_AFTER[id];
}

/**
 * Fetch one catalogue from its service. The PROMISE is shared, so several
 * callers join one request; a failure rejects and is not remembered.
 */
export function load<K extends SourceId>(id: K): Promise<SourcePayloads[K]> {
    const running = inflight.get(id) as Promise<SourcePayloads[K]> | undefined;
    if (running) return running;
    const pending = (LOADERS[id] as () => Promise<SourcePayloads[K]>)()
        .then(rows => {
            memory.set(id, { at: Date.now(), rows });
            writeStored(id, rows);
            return rows;
        })
        .finally(() => { inflight.delete(id); });
    inflight.set(id, pending);
    return pending;
}

/** For the preview harness and the checks. */
export function _resetSiteSearchCache(): void {
    memory.clear();
    inflight.clear();
    try {
        for (const id of Object.keys(REFRESH_AFTER)) localStorage.removeItem(STORAGE_PREFIX + id);
    } catch { /* nothing to do */ }
}
