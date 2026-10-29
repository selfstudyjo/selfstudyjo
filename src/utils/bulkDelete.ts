/**
 * Delete many records in one action, through a bulk endpoint when the backend
 * has one and one-by-one when it does not.
 *
 * The fallback exists because a deploy is per replica: a replica that has not
 * pulled the build with `/bulk-delete` answers 404 (or 405), and the feature
 * must still work there rather than reading as a broken button. Plain module -
 * no Vue - so the three views share one definition of "what happened".
 */
import { ApiError } from '@/services/api';

export interface BulkDeleteResult {
    /** Ids the backend confirmed as deleted. */
    deleted: string[];
    /** Ids that were asked for and are still there (failed or not owned). */
    failed: string[];
}

export interface BulkResponse {
    deleted?: string[];
    failed?: string[];
    skipped?: string[];
    pending?: string[];
    remaining?: number;
}

const CHUNK = 200;

function isMissingRoute(error: unknown): boolean {
    const status = error instanceof ApiError ? error.status : (error as any)?.status;
    return status === 404 || status === 405;
}

/**
 * `bulk(ids)` calls the bulk endpoint once and may report `pending` (the CV
 * service caps a request by count and time); those are sent again until none
 * are left or a round makes no progress.
 */
export async function runBulkDelete(
    ids: string[],
    bulk: (ids: string[]) => Promise<BulkResponse>,
    single: (id: string) => Promise<unknown>,
): Promise<BulkDeleteResult> {
    const wanted = Array.from(new Set(ids.filter(Boolean)));
    const deleted = new Set<string>();
    if (!wanted.length) return { deleted: [], failed: [] };

    try {
        // Both backends refuse more than 500 ids in one body; stay well under.
        for (let start = 0; start < wanted.length; start += CHUNK) {
            let todo = wanted.slice(start, start + CHUNK);
            for (let round = 0; todo.length && round < 50; round++) {
                const res = await bulk(todo);
                const got = (res?.deleted || []).filter(id => !deleted.has(id));
                got.forEach(id => deleted.add(id));
                const pending = res?.pending || [];
                if (!pending.length || !got.length) break;
                todo = pending;
            }
        }
    } catch (error) {
        if (!isMissingRoute(error)) throw error;
        for (const id of wanted) {
            if (deleted.has(id)) continue;
            try {
                await single(id);
                deleted.add(id);
            } catch {
                /* reported below as failed */
            }
        }
    }
    return { deleted: wanted.filter(id => deleted.has(id)), failed: wanted.filter(id => !deleted.has(id)) };
}
