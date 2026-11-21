/**
 * Fetches what the signed-in student may use (app 19 /course-access/), cached
 * for a minute per user (the promise, so concurrent callers share a request).
 * A failure answers OPEN_ACCESS - see utils/courseAccess.ts for why.
 */
import { apiService } from './api';
import { serviceRegistry } from './config';
import { OPEN_ACCESS, type CourseAccess } from '@/utils/courseAccess';

const TTL = 60_000;
let cache: { key: string; at: number; value: Promise<CourseAccess> } | null = null;

export const courseAccessService = {
    async get(userId: string | undefined | null, force = false): Promise<CourseAccess> {
        const key = String(userId || '');
        const now = Date.now();
        if (!force && cache && cache.key === key && now - cache.at < TTL) return cache.value;
        const value = (async (): Promise<CourseAccess> => {
            try {
                const base = await serviceRegistry.getRandomCourseReplica();
                if (!base) return OPEN_ACCESS;
                const data = await apiService.get<Partial<CourseAccess>>(
                    base, `/course-access/?user_id=${encodeURIComponent(key)}`);
                return { courses: data?.courses || {}, denied_labs: data?.denied_labs || [] };
            } catch {
                return OPEN_ACCESS;     // an older app 19 answers 404: nothing is restricted
            }
        })();
        cache = { key, at: now, value };
        return value;
    },
    clear() { cache = null; },
};
