import { apiService, ApiError, withReplicas } from './api';
import { serviceRegistry } from './config';
import type { TranslationMap } from '@/i18n/records';

export interface Runbook {
    /**
     * The Arabic and Chinese copies of this record's own text, keyed by language
     * then by field. English is NOT in here -- it is the field beside it.
     *
     * Always present from a backend carrying `utils/translations.py`, and
     * `{}` when nothing has been translated yet; optional here because this
     * bundle and those services deploy separately, so a record from an
     * older replica has no such key at all. Read it with `$td(record)` /
     * `td(record)` rather than by hand -- see `src/i18n/records.ts`.
     */
    translations?: TranslationMap;
    id: number;
    sync_id: string;
    title: string;
    /**
     * The course and lesson this runbook documents, as app 17 stores them —
     * `external_course_id` and `external_lesson_id`, the same strings the course
     * service uses. Both are `''` on a runbook nobody linked, which is most of
     * the older ones, so treat an empty string as "not linked" rather than
     * assuming the field is absent.
     */
    course_id?: string;
    lesson_id?: string;
    sections?: RunBookSection[];
}

export interface RunBookSection {
    /**
     * The Arabic and Chinese copies of this record's own text, keyed by language
     * then by field. English is NOT in here -- it is the field beside it.
     *
     * Always present from a backend carrying `utils/translations.py`, and `{}`
     * when nothing has been translated yet; optional here because this bundle
     * and those services deploy separately, so a record from an older replica
     * has no such key at all. Read it with `$td(record)` / `td(record)` rather
     * than by hand -- see `src/i18n/records.ts`.
     */
    translations?: TranslationMap;
    id: number;
    sync_id: string;
    runbook: number;
    title: string | null;
    is_code_block: boolean;
    content: string;
    bg_color: string;
    text_color: string;
    position: number;
}

export interface RunbookListResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: Runbook[];
}

export class RunbookService {
    private appId = parseInt(import.meta.env.VITE_RUNBOOK_APP_ID || '17');

    /**
     * One replica, PINNED for the life of the tab.
     *
     * This used to be a bare `Math.random()` over the replica list, which is a
     * different thing wearing the same name: it re-picked on every single call.
     * `ServiceRegistry.getRandomReplica` spreads load on the first call and then
     * reuses that choice, and the reuse is the part that matters — replication
     * here is push-then-repair, so re-picking gives a coin flip on whether a
     * write has reached the replica now being read, and the user sees "I saved
     * it and it did not save".
     *
     * That was working rule 31 in this service: the pin is implemented in the
     * registry and only exists when a caller passes the `appId`, and nine
     * services each wrote their own wrapper that left it off. Nothing here is
     * new machinery — `getRandomRunbookReplica()` has existed in config.ts all
     * along and this method simply was not using it.
     */
    async getRandomReplica(): Promise<string> {
        const replica = await serviceRegistry.getRandomRunbookReplica();
        if (!replica) {
            throw new Error('No runbook replicas available');
        }
        return replica;
    }

    /**
     * Every runbook belonging to a course, keyed by the lesson it documents.
     *
     * WHY ONE REQUEST AND NOT ONE PER LESSON. A course page renders ten or
     * twenty lesson cards and each one wants to know whether a runbook exists
     * for it. Asked per lesson that is twenty round trips against a
     * PythonAnywhere replica whose first answer of the day takes ~20 seconds,
     * for a link. App 17's list route filters on `course_id`, so it is one.
     *
     * WHY IT NEVER THROWS. This decorates a lesson card. A course page must not
     * fail to render, or a lesson fail to be readable, because the runbook
     * service is cold — exactly the trade `notify()` makes. The caller gets an
     * empty map and the buttons simply do not appear.
     *
     * A lesson with several runbooks keeps the FIRST by id, which is the oldest:
     * the card has room for one link, and picking the newest would move the
     * destination under a returning reader every time somebody adds one.
     */
    async getRunbooksByLesson(courseId: string): Promise<Map<string, Runbook>> {
        const byLesson = new Map<string, Runbook>();
        if (!courseId) return byLesson;
        try {
            const rows = await withReplicas(this.appId, 'runbook', (base) =>
                apiService.get<any>(
                    base, `/runbooks/?course_id=${encodeURIComponent(courseId)}`));
            const list: Runbook[] = Array.isArray(rows)
                ? rows
                : (rows && Array.isArray(rows.results) ? rows.results : []);
            // Ascending by id so "first wins" means the oldest, whatever order
            // the replica answered in.
            list.slice()
                .sort((a, b) => (a.id || 0) - (b.id || 0))
                .forEach(runbook => {
                    const lessonId = (runbook.lesson_id || '').trim();
                    if (!lessonId || byLesson.has(lessonId)) return;
                    byLesson.set(lessonId, runbook);
                });
        } catch {
            // Deliberately silent. See above: an absent link is a far better
            // outcome than a course page that will not load.
        }
        return byLesson;
    }

    async getAllRunbooks(): Promise<Runbook[]> {
        try {
            const baseUrl = await this.getRandomReplica();
            const response = await apiService.get<any>(baseUrl, '/runbooks/');

            // Handle different response formats
            if (Array.isArray(response)) {
                return response;
            } else if (response && response.results && Array.isArray(response.results)) {
                return response.results;
            } else if (response && Array.isArray(response)) {
                return response;
            } else {
                return [];
            }
        } catch (error) {
            throw error;
        }
    }

    async getRunbookById(id: number): Promise<Runbook> {
        try {
            const baseUrl = await this.getRandomReplica();
            const response = await apiService.get<Runbook>(baseUrl, `/runbooks/${id}/`);
            return response;
        } catch (error) {
            throw error;
        }
    }

    async getRunbookByTitle(title: string): Promise<Runbook> {
        try {
            const baseUrl = await this.getRandomReplica();
            const response = await apiService.get<Runbook>(baseUrl, `/runbooks/by_title/?title=${encodeURIComponent(title)}`);
            return response;
        } catch (error) {
            throw error;
        }
    }

    async searchRunbooks(query: string): Promise<Runbook[]> {
        try {
            const baseUrl = await this.getRandomReplica();
            const response = await apiService.get<any>(baseUrl, `/runbooks/?title=${encodeURIComponent(query)}`);

            // Handle different response formats
            if (Array.isArray(response)) {
                return response;
            } else if (response && response.results && Array.isArray(response.results)) {
                return response.results;
            } else {
                return [];
            }
        } catch (error) {
            throw error;
        }
    }

    async getRunbookWithSections(id: number): Promise<Runbook> {
        try {
            const baseUrl = await this.getRandomReplica();

            // Fetch runbook details
            const runbook = await this.getRunbookById(id);

            // Fetch sections for this runbook
            try {
                const sections = await apiService.get<any>(
                    baseUrl,
                    `/sections/?runbook_id=${id}`
                );

                // Handle different response formats for sections
                let sectionsArray: RunBookSection[] = [];
                if (Array.isArray(sections)) {
                    sectionsArray = sections;
                } else if (sections && sections.results && Array.isArray(sections.results)) {
                    sectionsArray = sections.results;
                }

                return {
                    ...runbook,
                    sections: sectionsArray.sort((a, b) => a.position - b.position)
                };
            } catch (sectionError) {
                return {
                    ...runbook,
                    sections: []
                };
            }
        } catch (error) {
            throw error;
        }
    }
}

export const runbookService = new RunbookService();
