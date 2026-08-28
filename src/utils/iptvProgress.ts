/**
 * Watch progress in `localStorage`.
 *
 * The DOM half of `iptvEngine.ts`, kept apart for the same reason
 * `theme/apply.ts` is kept apart from `theme/contrast.ts`: the *decisions* -
 * what counts as resumable, what counts as watched, how many entries are kept -
 * are pure and checked, and this is the four lines that touch storage.
 *
 * WHY IT IS PER USER
 * ==================
 *
 * Keyed on the signed-in username, so two people sharing a laptop do not resume
 * into each other's films. Same reasoning as the notification tombstone set,
 * which is also per username in `localStorage`.
 *
 * WHY IT IS NOT ON THE SERVER
 * ===========================
 *
 * A position update fires every few seconds while something is playing. Sent to
 * app 38 that is a write every few seconds per viewer, each one a GitLab commit
 * against a 2,000-a-minute allowance shared with the uploads - so a dozen people
 * watching would starve the storage of the requests it needs to serve them. The
 * cost is that progress does not follow somebody to another device, which is a
 * real limitation and the right trade for a free service. A per-user record on
 * app 13 is the way to close it, and it is deliberately not attempted here.
 *
 * **Every read and write is guarded.** `localStorage` throws rather than
 * returning null in Safari's private mode and when a quota is full, and a player
 * that fails to start because it could not save a bookmark is a much worse
 * failure than one that forgets where you were.
 */

import { PROGRESS_KEY, recordProgress, type ProgressMap } from './iptvEngine';

function username(): string {
    try {
        const raw = localStorage.getItem('user');
        if (!raw) return 'anon';
        const parsed = JSON.parse(raw);
        return String(parsed?.username || parsed?.id || 'anon');
    } catch {
        return 'anon';
    }
}

function key(): string {
    return `${PROGRESS_KEY}:${username()}`;
}

export function loadProgress(): ProgressMap {
    try {
        const raw = localStorage.getItem(key());
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as ProgressMap : {};
    } catch {
        return {};
    }
}

export function saveProgress(map: ProgressMap): void {
    try {
        localStorage.setItem(key(), JSON.stringify(map));
    } catch {
        /* A full quota must not stop playback. */
    }
}

/** Record a position and persist. Returns the new map for the caller's state. */
export function noteProgress(map: ProgressMap, id: string, position: number,
                             duration: number): ProgressMap {
    const next = recordProgress(map, id, position, duration);
    saveProgress(next);
    return next;
}

export function clearProgress(): void {
    try {
        localStorage.removeItem(key());
    } catch {
        /* nothing to do */
    }
}
